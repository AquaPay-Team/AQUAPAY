import assert from "node:assert/strict";
import { test } from "node:test";

import "../../auth/setupEnv.js";

import app from "../../../app.js";
import pool from "../../../config/db.js";
import statusController from "./status.controller.js";
import statusModel from "./status.model.js";
import statusService from "./status.service.js";

const caseRow = {
  id: 13,
  status: "pending",
  steps_completed: 1,
  business_type: "Retail Store",
};

const stepRows = [
  {
    step_number: 1,
    status: "completed",
    completed_at: new Date("2026-10-31T08:00:00.000Z"),
    failure_code: "INTERNAL_VALUE",
  },
  { step_number: 2, status: "in_progress", completed_at: null },
];

function replaceModelMethods(overrides) {
  const originals = Object.fromEntries(
    Object.keys(overrides).map((name) => [name, statusModel[name]]),
  );

  Object.assign(statusModel, overrides);

  return () => Object.assign(statusModel, originals);
}

test("KYC status returns a simplified user projection and step progress", async () => {
  const calls = [];

  const restore = replaceModelMethods({
    findCasesByUserId: async (userId) => {
      calls.push(["case", userId]);
      return [caseRow];
    },
    findStepsByCaseId: async (caseId) => {
      calls.push(["steps", caseId]);
      return stepRows;
    },
  });

  try {
    const result = await statusService.getKycStatus("52");

    assert.deepEqual(calls, [
      ["case", "52"],
      ["steps", 13],
    ]);

    assert.deepEqual(result, {
      hasCase: true,
      status: "pending",
      currentStep: 2,
      completedSteps: [1],
      currentStepDetails: {
        stepNumber: 2,
        status: "in_progress",
        completedAt: null,
      },
    });

    assert.equal("kyc" in result, false);
    assert.equal("businessType" in result, false);
  } finally {
    restore();
  }
});

test("KYC status returns a simplified response when the user has no case", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [],
    findStepsByCaseId: async () => {
      throw new Error("Step query must not run without a case");
    },
  });

  try {
    assert.deepEqual(await statusService.getKycStatus("52"), {
      hasCase: false,
      status: null,
      currentStep: null,
      completedSteps: [],
      currentStepDetails: null,
    });
  } finally {
    restore();
  }
});

test("KYC status rejects duplicate cases instead of selecting an arbitrary case", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [
      caseRow,
      { ...caseRow, id: 14 },
    ],
    findStepsByCaseId: async () => [],
  });

  try {
    await assert.rejects(
      statusService.getKycStatus("52"),
      (error) =>
        error.statusCode === 409 &&
        error.code === "KYC_CASE_AMBIGUOUS",
    );
  } finally {
    restore();
  }
});

test("KYC status hides database errors behind a generic service-unavailable error", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => {
      throw new Error("internal SQL detail");
    },
  });

  try {
    await assert.rejects(
      statusService.getKycStatus("52"),
      (error) =>
        error.statusCode === 503 &&
        error.code === "SERVICE_UNAVAILABLE" &&
        !error.message.includes("internal SQL detail"),
    );
  } finally {
    restore();
  }
});

test("KYC status controller reads identity from authenticated request context", async () => {
  const originalGetStatus = statusService.getKycStatus;
  let requestedUserId;

  statusService.getKycStatus = async (userId) => {
    requestedUserId = userId;

    return {
      hasCase: false,
      status: null,
      currentStep: null,
      completedSteps: [],
      currentStepDetails: null,
    };
  };

  try {
    const res = {
      statusCode: undefined,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    statusController.getKycStatus(
      { user: { id: "52" }, params: { userId: "99" } },
      res,
      (error) => {
        throw error;
      },
    );

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(requestedUserId, "52");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    assert.deepEqual(res.body.data, {
      hasCase: false,
      status: null,
      currentStep: null,
      completedSteps: [],
      currentStepDetails: null,
    });
  } finally {
    statusService.getKycStatus = originalGetStatus;
  }
});

test("KYC status model uses parameterized queries and approved schema columns", async () => {
  const originalExecute = pool.execute;
  const calls = [];

  pool.execute = async (sql, params) => {
    calls.push({ sql, params });
    return [[]];
  };

  try {
    await statusModel.findCasesByUserId("52");
    await statusModel.findStepsByCaseId(13);

    assert.equal(calls.length, 2);

    assert.equal(calls[0].params[0], "52");
    assert.match(calls[0].sql, /steps_completed/);
    assert.match(calls[0].sql, /business_type/);
    assert.doesNotMatch(calls[0].sql, /current_step|draft/i);

    assert.equal(calls[1].params[0], 13);
    assert.match(calls[1].sql, /completed_at/);
    assert.match(calls[1].sql, /ORDER BY step_number ASC/);
  } finally {
    pool.execute = originalExecute;
  }
});

test("KYC status returns only masked Aadhaar last four for a completed verification", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => [
      { step_number: 1, status: "completed", completed_at: null },
      { step_number: 2, status: "completed", completed_at: null },
      { step_number: 3, status: "pending", completed_at: null },
    ],
    findVerifiedAadhaarByCaseId: async (caseId) => {
      assert.equal(caseId, 13);
      return [{ masked_identifier: "XXXXXX1234", verified_name: "Verified Example" }];
    },
  });

  try {
    const result = await statusService.getKycStatus("52");
    assert.deepEqual(result.aadhaar, {
      maskedIdentifier: "•••• •••• 1234",
      verifiedName: "Verified Example",
    });
    assert.equal(JSON.stringify(result).includes("XXXXXX1234"), false);
  } finally {
    restore();
  }
});

test("KYC status never exposes unmasked or malformed Aadhaar identifiers", async () => {
  let raw = "123456789012";
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => [
      { step_number: 2, status: "completed", completed_at: null },
    ],
    findVerifiedAadhaarByCaseId: async () => [
      { masked_identifier: raw, verified_name: "Verified Example" },
    ],
  });

  try {
    assert.equal("aadhaar" in await statusService.getKycStatus("52"), false);
    raw = "XXXXXX1234-INJECTION";
    assert.equal("aadhaar" in await statusService.getKycStatus("52"), false);
    raw = null;
    assert.equal("aadhaar" in await statusService.getKycStatus("52"), false);
  } finally {
    restore();
  }
});

test("KYC status does not query Aadhaar records until Step 2 is completed", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => stepRows,
    findVerifiedAadhaarByCaseId: async () => {
      throw new Error("Should not retrieve an unverified Aadhaar identifier");
    },
  });

  try {
    assert.equal("aadhaar" in await statusService.getKycStatus("52"), false);
  } finally {
    restore();
  }
});

test("KYC status fails closed for duplicate verified Aadhaar records", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => [
      { step_number: 2, status: "completed", completed_at: null },
    ],
    findVerifiedAadhaarByCaseId: async () => [
      { masked_identifier: "XXXXXX1234" },
      { masked_identifier: "XXXXXX5678" },
    ],
  });

  try {
    await assert.rejects(
      statusService.getKycStatus("52"),
      (error) => error.statusCode === 409 &&
        error.code === "AADHAAR_VERIFICATION_AMBIGUOUS",
    );
  } finally {
    restore();
  }
});

test("KYC status masks database failures retrieving verified Aadhaar", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => [
      { step_number: 2, status: "completed", completed_at: null },
    ],
    findVerifiedAadhaarByCaseId: async () => {
      throw new Error("private SQL information");
    },
  });

  try {
    await assert.rejects(
      statusService.getKycStatus("52"),
      (error) => error.statusCode === 503 &&
        error.code === "SERVICE_UNAVAILABLE" &&
        !error.message.includes("private SQL information"),
    );
  } finally {
    restore();
  }
});

test("Aadhaar status model scopes the verified record to a KYC case", async () => {
  const originalExecute = pool.execute;
  pool.execute = async (sql, params) => {
    assert.deepEqual(params, [13]);
    assert.match(sql, /v\.case_id = \?/);
    assert.match(sql, /verification_type = 'aadhaar'/);
    assert.match(sql, /v\.status = 'verified'/);
    assert.match(sql, /s\.status = 'completed'/);
    assert.doesNotMatch(sql, /SELECT \*/i);
    return [[{ masked_identifier: "XXXXXX1234", verified_name: "Verified Example" }]];
  };

  try {
    const result = await statusModel.findVerifiedAadhaarByCaseId(13);
    assert.equal(result.length, 1);
  } finally {
    pool.execute = originalExecute;
  }
});

test("KYC status restores a verified PAN mask without exposing the full number", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => [
      { step_number: 3, status: "completed", completed_at: null },
    ],
    findVerifiedPanByCaseId: async (caseId) => {
      assert.equal(caseId, 13);
      return [{ masked_identifier: "XXXXXX234F", verified_name: "PAN Verified" }];
    },
  });

  try {
    const result = await statusService.getKycStatus("52");
    assert.deepEqual(result.pan, {
      maskedIdentifier: "XXXXXX234F",
      verifiedName: "PAN Verified",
    });
    assert.equal(JSON.stringify(result).includes("ABCDE1234F"), false);
  } finally {
    restore();
  }
});

test("KYC status fails closed for malformed PAN masks and missing Step 3", async () => {
  let completed = true;
  let masked = "ABCDE1234F";
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => completed
      ? [{ step_number: 3, status: "completed", completed_at: null }]
      : [{ step_number: 3, status: "pending", completed_at: null }],
    findVerifiedPanByCaseId: async () => [{ masked_identifier: masked }],
  });
  try {
    assert.equal("pan" in await statusService.getKycStatus("52"), false);
    masked = "XXXXXX234F";
    completed = false;
    assert.equal("pan" in await statusService.getKycStatus("52"), false);
  } finally {
    restore();
  }
});

test("KYC status rejects ambiguous verified PAN rows", async () => {
  const restore = replaceModelMethods({
    findCasesByUserId: async () => [caseRow],
    findStepsByCaseId: async () => [
      { step_number: 3, status: "completed", completed_at: null },
    ],
    findVerifiedPanByCaseId: async () => [
      { masked_identifier: "XXXXXX234F" },
      { masked_identifier: "XXXXXX567P" },
    ],
  });
  try {
    await assert.rejects(
      statusService.getKycStatus("52"),
      (error) => error.statusCode === 409 &&
        error.code === "PAN_VERIFICATION_AMBIGUOUS",
    );
  } finally {
    restore();
  }
});

test("PAN status query is scoped to verified Step 3 and the case", async () => {
  const originalExecute = pool.execute;
  pool.execute = async (sql, params) => {
    assert.deepEqual(params, [13]);
    assert.match(sql, /v\.case_id = \?/);
    assert.match(sql, /verification_type = 'pan'/);
    assert.match(sql, /v\.status = 'verified'/);
    assert.match(sql, /s\.status = 'completed'/);
    assert.doesNotMatch(sql, /SELECT \*/i);
    return [[{ masked_identifier: "XXXXXX234F", verified_name: "PAN Verified" }]];
  };
  try {
    assert.equal((await statusModel.findVerifiedPanByCaseId(13)).length, 1);
  } finally {
    pool.execute = originalExecute;
  }
});

test("mounted KYC status route rejects unauthenticated requests", async () => {
  const server = app.listen(0);

  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/kyc/status`,
    );

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.code, "UNAUTHORIZED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
