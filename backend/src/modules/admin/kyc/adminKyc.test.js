import assert from "node:assert/strict";
import { test } from "node:test";
import adminKycModel from "./adminKyc.model.js";
import {
  getKycApplications,
  getKycDocumentAccess,
  approveKycApplication,
  rejectKycApplication,
} from "./adminKyc.service.js";
import getCloudinary from "../../../config/cloudinary.js";

// ---------------------------------------------------------
// HELPERS — DOCUMENT ACCESS TESTS
// ---------------------------------------------------------

function mockMediaAsset(t, asset) {
  const original = adminKycModel.findMediaAssetForAdmin;
  let capturedArguments = null;

  adminKycModel.findMediaAssetForAdmin = async (...args) => {
    capturedArguments = args;
    return asset;
  };

  t.after(() => {
    adminKycModel.findMediaAssetForAdmin = original;
  });

  return () => capturedArguments;
}

function mockCloudinary(t, implementation) {
  // Test credentials only. No real Cloudinary request is made.
  process.env.CLOUDINARY_CLOUD_NAME = "aquapay-test-cloud";
  process.env.CLOUDINARY_API_KEY = "123456789";
  process.env.CLOUDINARY_API_SECRET = "aquapay-test-secret";

  const cloudinary = getCloudinary();
  const original = cloudinary.utils.private_download_url;

  cloudinary.utils.private_download_url = implementation;

  t.after(() => {
    cloudinary.utils.private_download_url = original;
  });

  return cloudinary;
}

function assertApiError(error, statusCode, code) {
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return true;
}

// ---------------------------------------------------------
// HELPERS — APPROVAL TESTS
// ---------------------------------------------------------

function mockApprovalDependencies(
  t,
  {
    application = { id: 14, status: "submitted" },
    updateResult = true,
    historyError = null,
  } = {},
) {
  const originalMethods = {
    getConnection: adminKycModel.getConnection,
    findKycCaseForUpdate: adminKycModel.findKycCaseForUpdate,
    approveKycCase: adminKycModel.approveKycCase,
    insertStatusHistory: adminKycModel.insertStatusHistory,
  };

  const events = [];

  const connection = {
    beginTransaction: async () => {
      events.push("begin");
    },

    commit: async () => {
      events.push("commit");
    },

    rollback: async () => {
      events.push("rollback");
    },

    release: () => {
      events.push("release");
    },
  };

  adminKycModel.getConnection = async () => {
    events.push("getConnection");
    return connection;
  };

  adminKycModel.findKycCaseForUpdate = async (conn, caseId) => {
    assert.equal(conn, connection);
    events.push(["findKycCaseForUpdate", caseId]);
    return application;
  };

  adminKycModel.approveKycCase = async (conn, caseId) => {
    assert.equal(conn, connection);
    events.push(["approveKycCase", caseId]);
    return updateResult;
  };

  adminKycModel.insertStatusHistory = async (conn, details) => {
    assert.equal(conn, connection);
    events.push(["insertStatusHistory", details]);

    if (historyError) {
      throw historyError;
    }

    return 123;
  };

  t.after(() => {
    Object.assign(adminKycModel, originalMethods);
  });

  return { events, connection };
}

// ---------------------------------------------------------
// EXISTING TESTS — KYC APPLICATION LISTING
// ---------------------------------------------------------

test("adminKyc.service: uses submitted and under_review by default", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    let capturedStatuses = null;
    let capturedOptions = null;

    adminKycModel.findKycApplications = async (options) => {
      capturedOptions = options;
      capturedStatuses = options.statuses;
      return [{ case_id: 1, kyc_status: "submitted" }];
    };

    adminKycModel.countKycApplications = async (statuses) => {
      assert.deepEqual(statuses, ["submitted", "under_review"]);
      return 1;
    };

    const result = await getKycApplications();

    assert.deepEqual(capturedStatuses, ["submitted", "under_review"]);
    assert.equal(capturedOptions.limit, 10);
    assert.equal(capturedOptions.offset, 0);

    assert.equal(result.applications.length, 1);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.limit, 10);
    assert.equal(result.pagination.total, 1);
    assert.equal(result.pagination.totalPages, 1);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

test("adminKyc.service: filters by a valid individual status", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    let capturedStatuses = null;

    adminKycModel.findKycApplications = async ({ statuses }) => {
      capturedStatuses = statuses;
      return [];
    };

    adminKycModel.countKycApplications = async () => 0;

    const result = await getKycApplications({
      status: "approved",
    });

    assert.deepEqual(capturedStatuses, ["approved"]);
    assert.deepEqual(result.filters.statuses, ["approved"]);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

test("adminKyc.service: rejects invalid status filters", async () => {
  await assert.rejects(
    getKycApplications({ status: "pending" }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "Invalid KYC status filter");
      return true;
    },
  );
});

test("adminKyc.service: rejects invalid page numbers", async () => {
  const invalidPages = [0, -1, 1.5, "abc"];

  for (const page of invalidPages) {
    await assert.rejects(
      getKycApplications({ page }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "Page must be a positive integer");
        return true;
      },
    );
  }
});

test("adminKyc.service: rejects invalid page limits", async () => {
  const invalidLimits = [0, -1, 1.5, 101, "abc"];

  for (const limit of invalidLimits) {
    await assert.rejects(
      getKycApplications({ limit }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /Limit must be between 1 and 100/);
        return true;
      },
    );
  }
});

test("adminKyc.service: calculates pagination correctly", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    let capturedOffset = null;
    let capturedLimit = null;

    adminKycModel.findKycApplications = async (options) => {
      capturedOffset = options.offset;
      capturedLimit = options.limit;
      return [];
    };

    adminKycModel.countKycApplications = async () => 45;

    const result = await getKycApplications({
      page: 2,
      limit: 10,
    });

    assert.equal(capturedOffset, 10);
    assert.equal(capturedLimit, 10);

    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.total, 45);
    assert.equal(result.pagination.totalPages, 5);
    assert.equal(result.pagination.hasNextPage, true);
    assert.equal(result.pagination.hasPreviousPage, true);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

test("adminKyc.service: reports no next page on the final page", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    adminKycModel.findKycApplications = async () => [];
    adminKycModel.countKycApplications = async () => 20;

    const result = await getKycApplications({
      page: 2,
      limit: 10,
    });

    assert.equal(result.pagination.hasNextPage, false);
    assert.equal(result.pagination.hasPreviousPage, true);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

// ---------------------------------------------------------
// EXISTING TESTS — SECURE DOCUMENT ACCESS
// ---------------------------------------------------------

test("adminKyc.service: generates secure document access successfully", async (t) => {
  const getCapturedArguments = mockMediaAsset(t, {
    id: 16,
    case_id: 14,
    asset_type: "shop_image",
    storage_provider: "cloudinary",
    storage_key: "aquapay/kyc/test-document",
    mime_type: "image/jpeg",
    status: "uploaded",
  });

  let capturedCloudinaryArguments = null;

  mockCloudinary(t, (...args) => {
    capturedCloudinaryArguments = args;
    return "https://example.test/temporary-document";
  });

  const before = Math.floor(Date.now() / 1000);

  const result = await getKycDocumentAccess(14, 16);

  const after = Math.floor(Date.now() / 1000);

  assert.deepEqual(getCapturedArguments(), [14, 16]);

  assert.equal(result.assetId, 16);
  assert.equal(result.caseId, 14);
  assert.equal(result.assetType, "shop_image");
  assert.equal(result.mimeType, "image/jpeg");

  assert.equal(
    result.documentUrl,
    "https://example.test/temporary-document",
  );

  assert.ok(result.expiresAt);

  const expiryTimestamp = Math.floor(
    new Date(result.expiresAt).getTime() / 1000,
  );

  assert.ok(expiryTimestamp >= before + 300);
  assert.ok(expiryTimestamp <= after + 300);

  assert.deepEqual(capturedCloudinaryArguments, [
    "aquapay/kyc/test-document",
    "jpg",
    {
      resource_type: "image",
      type: "authenticated",
      expires_at: expiryTimestamp,
    },
  ]);

  // Internal storage details must never appear in the API result.
  assert.equal("storage_key" in result, false);
  assert.equal("storage_provider" in result, false);
  assert.equal(
    JSON.stringify(result).includes("aquapay/kyc/test-document"),
    false,
  );
});

test("adminKyc.service: rejects invalid case and asset IDs", async (t) => {
  const original = adminKycModel.findMediaAssetForAdmin;
  let lookupCalled = false;

  adminKycModel.findMediaAssetForAdmin = async () => {
    lookupCalled = true;
    return null;
  };

  t.after(() => {
    adminKycModel.findMediaAssetForAdmin = original;
  });

  const invalidInputs = [
    ["abc", 16],
    [0, 16],
    [-1, 16],
    [14, "abc"],
    [14, 0],
    [14, -1],
    [14, 1.5],
    ["", 16],
    [14, ""],
  ];

  for (const [caseId, assetId] of invalidInputs) {
    await assert.rejects(
      getKycDocumentAccess(caseId, assetId),
      (error) => assertApiError(error, 400, "VALIDATION_ERROR"),
    );
  }

  assert.equal(lookupCalled, false);
});

test("adminKyc.service: returns 404 when document does not belong to the case", async (t) => {
  const getCapturedArguments = mockMediaAsset(t, null);

  await assert.rejects(
    getKycDocumentAccess(14, 999),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "NOT_FOUND");
      assert.equal(error.message, "KYC document not found");
      return true;
    },
  );

  assert.deepEqual(getCapturedArguments(), [14, 999]);
});

test("adminKyc.service: rejects unsupported storage providers", async (t) => {
  mockMediaAsset(t, {
    id: 16,
    case_id: 14,
    storage_provider: "local",
    storage_key: "private/document",
    mime_type: "image/jpeg",
  });

  await assert.rejects(
    getKycDocumentAccess(14, 16),
    (error) => assertApiError(error, 400, "UNSUPPORTED_STORAGE_PROVIDER"),
  );
});

test("adminKyc.service: rejects unsupported MIME types", async (t) => {
  mockMediaAsset(t, {
    id: 16,
    case_id: 14,
    storage_provider: "cloudinary",
    storage_key: "aquapay/kyc/test-document",
    mime_type: "application/pdf",
  });

  await assert.rejects(
    getKycDocumentAccess(14, 16),
    (error) => assertApiError(error, 400, "INVALID_DOCUMENT_FORMAT"),
  );
});

test("adminKyc.service: rejects missing storage keys", async (t) => {
  mockMediaAsset(t, {
    id: 16,
    case_id: 14,
    storage_provider: "cloudinary",
    storage_key: null,
    mime_type: "image/jpeg",
  });

  await assert.rejects(
    getKycDocumentAccess(14, 16),
    (error) => assertApiError(error, 400, "INVALID_DOCUMENT_FORMAT"),
  );
});

test("adminKyc.service: converts Cloudinary errors into a safe 503 response", async (t) => {
  mockMediaAsset(t, {
    id: 16,
    case_id: 14,
    storage_provider: "cloudinary",
    storage_key: "aquapay/kyc/test-document",
    mime_type: "image/jpeg",
  });

  mockCloudinary(t, () => {
    throw new Error("Internal Cloudinary error with sensitive details");
  });

  await assert.rejects(
    getKycDocumentAccess(14, 16),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "DOCUMENT_ACCESS_UNAVAILABLE");
      assert.equal(
        error.message,
        "Document access is temporarily unavailable",
      );

      assert.equal(
        error.message.includes("Internal Cloudinary error"),
        false,
      );

      return true;
    },
  );
});

// ---------------------------------------------------------
// NEW TESTS — ADMIN KYC APPROVAL
// ---------------------------------------------------------

test("adminKyc.service: approves a submitted application transactionally", async (t) => {
  const { events } = mockApprovalDependencies(t);

  const result = await approveKycApplication(14, 5);

  assert.deepEqual(result, {
    caseId: 14,
    previousStatus: "submitted",
    status: "approved",
    message: "KYC application approved successfully",
  });

  assert.deepEqual(events, [
    "getConnection",
    "begin",
    ["findKycCaseForUpdate", 14],
    ["approveKycCase", 14],
    [
      "insertStatusHistory",
      {
        caseId: 14,
        oldStatus: "submitted",
        newStatus: "approved",
        actorUserId: 5,
        reason: null,
      },
    ],
    "commit",
    "release",
  ]);
});

test("adminKyc.service: approves an under_review application", async (t) => {
  mockApprovalDependencies(t, {
    application: { id: 14, status: "under_review" },
  });

  const result = await approveKycApplication(14, 5);

  assert.equal(result.previousStatus, "under_review");
  assert.equal(result.status, "approved");
});

test("adminKyc.service: returns 404 when approval case does not exist", async (t) => {
  const { events } = mockApprovalDependencies(t, {
    application: null,
  });

  await assert.rejects(
    approveKycApplication(999, 5),
    (error) => assertApiError(error, 404, "NOT_FOUND"),
  );

  assert.deepEqual(events, [
    "getConnection",
    "begin",
    ["findKycCaseForUpdate", 999],
    "rollback",
    "release",
  ]);
});

test("adminKyc.service: prevents approval of an already approved application", async (t) => {
  const { events } = mockApprovalDependencies(t, {
    application: { id: 14, status: "approved" },
  });

  await assert.rejects(
    approveKycApplication(14, 5),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "INVALID_KYC_STATE");
      return true;
    },
  );

  assert.deepEqual(events, [
    "getConnection",
    "begin",
    ["findKycCaseForUpdate", 14],
    "rollback",
    "release",
  ]);
});

test("adminKyc.service: prevents approval of a rejected application", async (t) => {
  const { events } = mockApprovalDependencies(t, {
    application: { id: 14, status: "rejected" },
  });

  await assert.rejects(
    approveKycApplication(14, 5),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "INVALID_KYC_STATE");
      return true;
    },
  );

  assert.deepEqual(events, [
    "getConnection",
    "begin",
    ["findKycCaseForUpdate", 14],
    "rollback",
    "release",
  ]);
});

test("adminKyc.service: rolls back approval when status history insertion fails", async (t) => {
  const { events } = mockApprovalDependencies(t, {
    historyError: new Error("Simulated history insertion failure"),
  });

  await assert.rejects(
    approveKycApplication(14, 5),
    /Simulated history insertion failure/,
  );

  assert.deepEqual(events, [
    "getConnection",
    "begin",
    ["findKycCaseForUpdate", 14],
    ["approveKycCase", 14],
    [
      "insertStatusHistory",
      {
        caseId: 14,
        oldStatus: "submitted",
        newStatus: "approved",
        actorUserId: 5,
        reason: null,
      },
    ],
    "rollback",
    "release",
  ]);
});

function mockRejectionDependencies(
  t,
  {
    application = { id: 14, status: "submitted" },
    updateResult = true,
    historyError = null,
  } = {},
) {
  const originalMethods = {
    getConnection: adminKycModel.getConnection,
    findKycCaseForUpdate: adminKycModel.findKycCaseForUpdate,
    rejectKycCase: adminKycModel.rejectKycCase,
    insertStatusHistory: adminKycModel.insertStatusHistory,
  };

  const events = [];

  const connection = {
    beginTransaction: async () => {
      events.push("begin");
    },
    commit: async () => {
      events.push("commit");
    },
    rollback: async () => {
      events.push("rollback");
    },
    release: () => {
      events.push("release");
    },
  };

  adminKycModel.getConnection = async () => {
    events.push("getConnection");
    return connection;
  };

  adminKycModel.findKycCaseForUpdate = async (conn, caseId) => {
    assert.equal(conn, connection);
    events.push(["findKycCaseForUpdate", caseId]);
    return application;
  };

  adminKycModel.rejectKycCase = async (
    conn,
    caseId,
    rejectionReason,
  ) => {
    assert.equal(conn, connection);

    events.push([
      "rejectKycCase",
      caseId,
      rejectionReason,
    ]);

    return updateResult;
  };

  adminKycModel.insertStatusHistory = async (conn, details) => {
    assert.equal(conn, connection);

    events.push(["insertStatusHistory", details]);

    if (historyError) {
      throw historyError;
    }

    return 125;
  };

  t.after(() => {
    Object.assign(adminKycModel, originalMethods);
  });

  return { events, connection };
}

test(
  "adminKyc.service: rejects a submitted application transactionally",
  async (t) => {
    const { events } = mockRejectionDependencies(t);

    const result = await rejectKycApplication(
      14,
      5,
      "  Video KYC recording is unclear  ",
    );

    assert.deepEqual(result, {
      caseId: 14,
      previousStatus: "submitted",
      status: "rejected",
      message: "KYC application rejected successfully",
    });

    assert.deepEqual(events, [
      "getConnection",
      "begin",
      ["findKycCaseForUpdate", 14],
      ["rejectKycCase", 14, "Video KYC recording is unclear"],
      [
        "insertStatusHistory",
        {
          caseId: 14,
          oldStatus: "submitted",
          newStatus: "rejected",
          actorUserId: 5,
          reason: "Video KYC recording is unclear",
        },
      ],
      "commit",
      "release",
    ]);
  },
);

test(
  "adminKyc.service: rejects an under_review application",
  async (t) => {
    mockRejectionDependencies(t, {
      application: { id: 14, status: "under_review" },
    });

    const result = await rejectKycApplication(
      14,
      5,
      "New media verification required",
    );

    assert.equal(result.previousStatus, "under_review");
    assert.equal(result.status, "rejected");
  },
);

test(
  "adminKyc.service: requires a valid rejection reason",
  async () => {
    const invalidReasons = [
      undefined,
      null,
      "",
      "   ",
      123,
      {},
      "A".repeat(501),
    ];

    for (const reason of invalidReasons) {
      await assert.rejects(
        rejectKycApplication(14, 5, reason),
        (error) => assertApiError(
          error,
          400,
          "VALIDATION_ERROR",
        ),
      );
    }
  },
);

test(
  "adminKyc.service: returns 404 when rejection case does not exist",
  async (t) => {
    const { events } = mockRejectionDependencies(t, {
      application: null,
    });

    await assert.rejects(
      rejectKycApplication(999, 5, "Invalid video"),
      (error) => assertApiError(error, 404, "NOT_FOUND"),
    );

    assert.ok(events.includes("rollback"));
    assert.ok(!events.includes("commit"));
  },
);

test(
  "adminKyc.service: prevents duplicate rejection",
  async (t) => {
    const { events } = mockRejectionDependencies(t, {
      application: { id: 14, status: "rejected" },
    });

    await assert.rejects(
      rejectKycApplication(14, 5, "Invalid video"),
      (error) => assertApiError(
        error,
        409,
        "INVALID_KYC_STATE",
      ),
    );

    assert.ok(events.includes("rollback"));
    assert.ok(!events.includes("commit"));
  },
);

test(
  "adminKyc.service: prevents rejection of approved KYC",
  async (t) => {
    const { events } = mockRejectionDependencies(t, {
      application: { id: 14, status: "approved" },
    });

    await assert.rejects(
      rejectKycApplication(14, 5, "Invalid video"),
      (error) => assertApiError(
        error,
        409,
        "INVALID_KYC_STATE",
      ),
    );

    assert.ok(events.includes("rollback"));
    assert.ok(!events.includes("commit"));
  },
);

test(
  "adminKyc.service: rejects a failed status update",
  async (t) => {
    const { events } = mockRejectionDependencies(t, {
      updateResult: false,
    });

    await assert.rejects(
      rejectKycApplication(14, 5, "Invalid video"),
      (error) => assertApiError(
        error,
        409,
        "INVALID_KYC_STATE",
      ),
    );

    assert.ok(events.includes("rollback"));
    assert.ok(!events.includes("commit"));
    assert.equal(
      events.some(
        (event) =>
          Array.isArray(event) &&
          event[0] === "insertStatusHistory",
      ),
      false,
    );
  },
);

test(
  "adminKyc.service: rolls back rejection when history insertion fails",
  async (t) => {
    const { events } = mockRejectionDependencies(t, {
      historyError: new Error(
        "Simulated rejection history failure",
      ),
    });

    await assert.rejects(
      rejectKycApplication(14, 5, "Invalid video"),
      /Simulated rejection history failure/,
    );

    assert.ok(events.includes("rollback"));
    assert.ok(events.includes("release"));
    assert.ok(!events.includes("commit"));
  },
);
