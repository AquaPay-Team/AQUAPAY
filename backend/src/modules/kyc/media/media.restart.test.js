import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import pool from "../../../config/db.js";

import { restartRejectedKyc, uploadMedia } from "./media.service.js";
import getCloudinary from "../../../config/cloudinary.js";

import {
  findMediaByCaseId,
  findMediaByCaseIdForUpdate,
  deleteMediaByCaseId,
  insertMediaCleanupJobs,
  hasAllRequiredMedia,
  countUploadedAssetTypes,
} from "./media.model.js";

afterEach(() => {
  mock.restoreAll();
});

// =========================================================
// PART 1 — EXISTING KYC RESTART SERVICE TESTS
// =========================================================

/**
 * Mock the MySQL connection.
 * No real database queries are executed.
 */
function setupMockDatabase({
  status = "rejected",
  incompleteStep = null,
  historyFailure = false,
} = {}) {
  const calls = [];
  const caseId = 4;
  const userId = 7;

  const previousMedia = [
    {
      id: 1,
      case_id: caseId,
      asset_type: "shop_image",
      storage_provider: "cloudinary",
      storage_key: "aquapay/kyc/4/shop-image",
      status: "uploaded",
    },
    {
      id: 2,
      case_id: caseId,
      asset_type: "selfie",
      storage_provider: "cloudinary",
      storage_key: "aquapay/kyc/4/selfie",
      status: "verified",
    },
    {
      id: 3,
      case_id: caseId,
      asset_type: "consent_video",
      storage_provider: "cloudinary",
      storage_key: "aquapay/kyc/4/consent-video",
      status: "uploaded",
    },
  ];

  const connection = {
    beginTransaction: mock.fn(async () => {
      calls.push("begin");
    }),

    commit: mock.fn(async () => {
      calls.push("commit");
    }),

    rollback: mock.fn(async () => {
      calls.push("rollback");
    }),

    release: mock.fn(() => {
      calls.push("release");
    }),

    destroy: mock.fn(() => {
      calls.push("destroy");
    }),

    execute: mock.fn(async (sql, params = []) => {
      const query = sql.replace(/\s+/g, " ").trim();

      // Find and lock merchant KYC.
      if (
        query.includes("FROM kyc_cases") &&
        query.includes("FOR UPDATE")
      ) {
        return [[{
          id: caseId,
          user_id: userId,
          status,
          steps_completed: 7,
        }]];
      }

      // Verify individual KYC steps.
      if (
        query.includes("FROM kyc_steps") &&
        query.includes("FOR UPDATE")
      ) {
        const stepNumber = params[1];

        return [[{
          id: stepNumber,
          case_id: caseId,
          step_number: stepNumber,
          status:
            stepNumber === incompleteStep
              ? "pending"
              : "completed",
        }]];
      }

      // Lock previous media records.
      if (
        query.includes("FROM media_assets") &&
        query.includes("FOR UPDATE")
      ) {
        calls.push("lock_media");
        return [previousMedia];
      }

      // Insert Cloudinary cleanup jobs.
      if (
        query.startsWith(
          "INSERT INTO kyc_media_cleanup_outbox",
        )
      ) {
        calls.push("queue_cleanup");
        return [{ affectedRows: 1, insertId: 100 }];
      }

      // Delete previous media database records.
      if (query.startsWith("DELETE FROM media_assets")) {
        calls.push("delete_media");
        return [{ affectedRows: 3 }];
      }

      // Delete previous agreement acceptance.
      if (
        query.startsWith(
          "DELETE FROM agreement_acceptances",
        )
      ) {
        calls.push("delete_agreement");
        return [{ affectedRows: 1 }];
      }

      // Reset Steps 5, 6 and 7.
      if (query.startsWith("UPDATE kyc_steps")) {
        calls.push("reset_steps");
        return [{ affectedRows: 3 }];
      }

      // Count completed steps after reset.
      if (
        query.includes("COUNT(*) AS completed_count")
      ) {
        return [[{ completed_count: 4 }]];
      }

      // Update KYC progress.
      if (
        query.startsWith("UPDATE kyc_cases") &&
        query.includes("SET current_step = 5")
      ) {
        calls.push("update_progress");
        return [{ affectedRows: 1 }];
      }

      // Reopen rejected KYC.
      if (
        query.startsWith("UPDATE kyc_cases") &&
        query.includes("SET status = 'pending'")
      ) {
        calls.push("reopen_case");
        return [{ affectedRows: 1 }];
      }

      // Record status history.
      if (
        query.startsWith(
          "INSERT INTO kyc_status_history",
        )
      ) {
        calls.push("insert_history");

        if (historyFailure) {
          throw new Error("Simulated history failure");
        }

        return [{ insertId: 46 }];
      }

      throw new Error(`Unexpected SQL: ${query}`);
    }),
  };

  mock.method(
    pool,
    "getConnection",
    async () => connection,
  );

  return { connection, calls, caseId, userId };
}

// ---------------------------------------------------------
// TEST 1 — SUCCESSFUL RESTART
// ---------------------------------------------------------

test("rejected KYC restarts from Step 5", async () => {
  const { calls, userId } = setupMockDatabase();

  const result = await restartRejectedKyc(userId);

  assert.equal(result.status, "pending");
  assert.equal(result.previousStatus, "rejected");
  assert.equal(result.currentStep, 5);
  assert.equal(result.stepsCompleted, 4);

  assert.equal(result.deletedMediaCount, 3);
  assert.equal(result.deletedAgreementAcceptanceCount, 1);
  assert.equal(result.cleanupJobsQueued, 3);

  assert.deepEqual(result.requiredMedia, [
    "shop_image",
    "selfie",
    "consent_video",
  ]);

  assert.equal(
    calls.filter((call) => call === "queue_cleanup").length,
    3,
  );

  assert.ok(calls.includes("delete_media"));
  assert.ok(calls.includes("delete_agreement"));
  assert.ok(calls.includes("reset_steps"));
  assert.ok(calls.includes("insert_history"));
  assert.ok(calls.includes("commit"));
  assert.ok(calls.includes("release"));

  assert.ok(
    calls.indexOf("queue_cleanup") <
    calls.indexOf("delete_media"),
  );

  assert.ok(
    calls.indexOf("delete_media") <
    calls.indexOf("delete_agreement"),
  );
});

// ---------------------------------------------------------
// TEST 2 — DUPLICATE RESTART
// ---------------------------------------------------------

test("pending KYC cannot restart again", async () => {
  const { calls, userId } = setupMockDatabase({
    status: "pending",
  });

  await assert.rejects(
    restartRejectedKyc(userId),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "INVALID_KYC_STATE");
      return true;
    },
  );

  assert.ok(calls.includes("rollback"));
  assert.ok(!calls.includes("commit"));
  assert.ok(!calls.includes("invalidate_media"));
});

// ---------------------------------------------------------
// TEST 3 — APPROVED KYC CANNOT RESTART
// ---------------------------------------------------------

test("approved KYC cannot restart", async () => {
  const { calls, userId } = setupMockDatabase({
    status: "approved",
  });

  await assert.rejects(
    restartRejectedKyc(userId),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "INVALID_KYC_STATE");
      return true;
    },
  );

  assert.ok(calls.includes("rollback"));
  assert.ok(!calls.includes("commit"));
});

// ---------------------------------------------------------
// TEST 4 — STEPS 1–4 MUST BE COMPLETED
// ---------------------------------------------------------

test(
  "restart requires completed Steps 1 through 4",
  async () => {
    const { calls, userId } = setupMockDatabase({
      incompleteStep: 3,
    });

    await assert.rejects(
      restartRejectedKyc(userId),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(
          error.code,
          "KYC_PREREQUISITE_NOT_COMPLETED",
        );
        return true;
      },
    );

    assert.ok(calls.includes("rollback"));
    assert.ok(!calls.includes("invalidate_media"));
    assert.ok(!calls.includes("commit"));
  },
);

// ---------------------------------------------------------
// TEST 5 — TRANSACTION ROLLBACK
// ---------------------------------------------------------

test(
  "history insertion failure triggers rollback",
  async () => {
    const { calls, userId } = setupMockDatabase({
      historyFailure: true,
    });

    await assert.rejects(
      restartRejectedKyc(userId),
      (error) => {
        assert.equal(error.statusCode, 503);
        assert.equal(error.code, "SERVICE_UNAVAILABLE");
        return true;
      },
    );

    assert.ok(calls.includes("insert_history"));
    assert.ok(calls.includes("rollback"));
    assert.ok(!calls.includes("commit"));
    assert.ok(calls.includes("release"));
  },
);

// =========================================================
// PART 2 — NEW FRESH-MEDIA MODEL TESTS
// =========================================================

const REQUIRED_MEDIA_TYPES = [
  "shop_image",
  "selfie",
  "consent_video",
];

/**
 * Create an isolated, in-memory database double.
 *
 * This is used only by the media-model tests.
 *
 * The actual model functions run their SQL against
 * this fake connection, not against Aiven.
 */
function setupMediaModelDatabase(initialAssets = []) {
  const assets = initialAssets.map(
    (asset) => ({ ...asset }),
  );

  const queries = [];

  const connection = {
    async execute(sql, params = []) {
      const query = sql.replace(/\s+/g, " ").trim();

      queries.push({
        sql: query,
        params: [...params],
      });

      // ---------------------------------------------------
      // Delete previous media records for the given case.
      // ---------------------------------------------------

      if (query.startsWith("DELETE FROM media_assets")) {
        assert.match(
          query,
          /WHERE case_id = \?/i,
        );

        const [caseId] = params;
        const previousLength = assets.length;

        for (let index = assets.length - 1; index >= 0; index -= 1) {
          if (assets[index].case_id === caseId) {
            assets.splice(index, 1);
          }
        }

        return [{
          affectedRows: previousLength - assets.length,
        }];
      }


      // ---------------------------------------------------
      // Count active distinct media asset types.
      // ---------------------------------------------------

      if (
        query.includes("COUNT(DISTINCT asset_type)")
      ) {
        assert.match(
          query,
          /WHERE case_id = \?/i,
        );

        assert.match(
          query,
          /status IN \('uploaded', 'verified'\)/i,
        );

        const [caseId] = params;

        let matchingAssets = assets.filter(
          (asset) =>
            asset.case_id === caseId &&
            ["uploaded", "verified"].includes(
              asset.status,
            ),
        );

        if (query.includes("asset_type IN")) {
          assert.match(
            query,
            /'shop_image', 'selfie', 'consent_video'/i,
          );

          matchingAssets = matchingAssets.filter(
            (asset) =>
              REQUIRED_MEDIA_TYPES.includes(
                asset.asset_type,
              ),
          );
        }

        const count = new Set(
          matchingAssets.map(
            (asset) => asset.asset_type,
          ),
        ).size;

        if (query.includes("AS uploaded_count")) {
          return [[{ uploaded_count: count }]];
        }

        if (query.includes("AS type_count")) {
          return [[{ type_count: count }]];
        }

        throw new Error(
          `Unexpected media count query: ${query}`,
        );
      }

      // ---------------------------------------------------
      // Read all media records for the given case.
      // ---------------------------------------------------

      if (
        query.includes("FROM media_assets") &&
        query.includes("ORDER BY created_at DESC")
      ) {
        const [caseId] = params;

        return [
          assets
            .filter(
              (asset) => asset.case_id === caseId,
            )
            .sort((a, b) => b.id - a.id)
            .map((asset) => ({ ...asset })),
        ];
      }

      throw new Error(
        `Unexpected media model SQL: ${query}`,
      );
    },
  };

  function addAsset(asset) {
    assets.push({ ...asset });
  }

  return {
    connection,
    assets,
    queries,
    addAsset,
  };
}

/**
 * Three media assets uploaded before admin rejection.
 */
function createPreviousMedia(caseId = 14) {
  return [
    {
      id: 1,
      case_id: caseId,
      asset_type: "shop_image",
      status: "uploaded",
    },
    {
      id: 2,
      case_id: caseId,
      asset_type: "selfie",
      status: "verified",
    },
    {
      id: 3,
      case_id: caseId,
      asset_type: "consent_video",
      status: "uploaded",
    },
  ];
}

// ---------------------------------------------------------
// TEST 6 — INVALIDATE OLD MEDIA WITHOUT DELETING RECORDS
// ---------------------------------------------------------

test(
  "media.model: deletes previous media records for the KYC case",
  async () => {
    const { connection, assets } =
      setupMediaModelDatabase([
        ...createPreviousMedia(),
        {
          id: 4,
          case_id: 99,
          asset_type: "shop_image",
          status: "uploaded",
        },
      ]);

    const deletedCount = await deleteMediaByCaseId(
      connection,
      14,
    );

    assert.equal(deletedCount, 3);

    const previousAssets = assets.filter(
      (asset) => asset.case_id === 14,
    );

    assert.equal(previousAssets.length, 0);

    // Another merchant's media must remain unchanged.
    const otherMerchantAsset = assets.find(
      (asset) => asset.id === 4,
    );

    assert.equal(
      otherMerchantAsset.status,
      "uploaded",
    );
  },
);

// ---------------------------------------------------------
// TEST 7 — ALL THREE NEW MEDIA TYPES ARE REQUIRED
// ---------------------------------------------------------


test(
  "media.model: all three fresh media types required after restart",
  async () => {
    const { connection, addAsset } =
      setupMediaModelDatabase(
        createPreviousMedia(),
      );

    // Before restart, all three old media types exist.
    assert.equal(
      await countUploadedAssetTypes(connection, 14),
      3,
    );

    assert.equal(
      await hasAllRequiredMedia(connection, 14),
      true,
    );

    // Merchant restarts rejected KYC.
    const deletedCount = await deleteMediaByCaseId(
      connection,
      14,
    );

    assert.equal(deletedCount, 3);

    // Old media must no longer count.
    assert.equal(
      await countUploadedAssetTypes(connection, 14),
      0,
    );

    assert.equal(
      await hasAllRequiredMedia(connection, 14),
      false,
    );

    // New upload 1: shop image.
    addAsset({
      id: 5,
      case_id: 14,
      asset_type: "shop_image",
      status: "uploaded",
    });

    assert.equal(
      await countUploadedAssetTypes(connection, 14),
      1,
    );

    assert.equal(
      await hasAllRequiredMedia(connection, 14),
      false,
    );

    // New upload 2: selfie.
    addAsset({
      id: 6,
      case_id: 14,
      asset_type: "selfie",
      status: "uploaded",
    });

    assert.equal(
      await countUploadedAssetTypes(connection, 14),
      2,
    );

    assert.equal(
      await hasAllRequiredMedia(connection, 14),
      false,
    );

    // New upload 3: consent video.
    addAsset({
      id: 7,
      case_id: 14,
      asset_type: "consent_video",
      status: "uploaded",
    });

    assert.equal(
      await countUploadedAssetTypes(connection, 14),
      3,
    );

    assert.equal(
      await hasAllRequiredMedia(connection, 14),
      true,
    );
  },
);

// ---------------------------------------------------------
// TEST 8 — DUPLICATE TYPES CANNOT REPLACE MISSING MEDIA
// ---------------------------------------------------------

test(
  "media.model: duplicate asset types cannot satisfy missing media",
  async () => {
    const { connection, addAsset } =
      setupMediaModelDatabase();

    // Shop image upload 1.
    addAsset({
      id: 1,
      case_id: 14,
      asset_type: "shop_image",
      status: "uploaded",
    });

    // Shop image upload 2.
    addAsset({
      id: 2,
      case_id: 14,
      asset_type: "shop_image",
      status: "uploaded",
    });

    // Selfie uploaded.
    addAsset({
      id: 3,
      case_id: 14,
      asset_type: "selfie",
      status: "verified",
    });

    // Consent video is missing.
    // Two shop images count as one distinct type.
    assert.equal(
      await countUploadedAssetTypes(
        connection,
        14,
      ),
      2,
    );

    assert.equal(
      await hasAllRequiredMedia(
        connection,
        14,
      ),
      false,
    );
  },
);

// ---------------------------------------------------------
// TEST 9 — PREVIOUS MEDIA REMAIN IN DATABASE HISTORY
// ---------------------------------------------------------


test(
  "media.model: only fresh media remain after KYC restart",
  async () => {
    const { connection, addAsset } =
      setupMediaModelDatabase(
        createPreviousMedia(),
      );

    // Delete old media during KYC restart.
    const deletedCount = await deleteMediaByCaseId(
      connection,
      14,
    );

    assert.equal(deletedCount, 3);

    // Merchant uploads a new shop image.
    addAsset({
      id: 4,
      case_id: 14,
      asset_type: "shop_image",
      status: "uploaded",
    });

    const records = await findMediaByCaseId(
      connection,
      14,
    );

    // Only the new media record should remain.
    assert.equal(records.length, 1);

    assert.equal(records[0].id, 4);
    assert.equal(records[0].status, "uploaded");
    assert.equal(records[0].asset_type, "shop_image");
  },
);

test(
  "media.service: completes Step 5 only after three fresh media uploads",
  async (t) => {
    const caseId = 14;
    const userId = 7;
    const assets = [];
    const transactions = [];

    let step5Status = "pending";
    let nextMediaId = 100;
    let uploadNumber = 0;

    // Keep test credentials separate from real credentials.
    const originalEnv = {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    };

    process.env.CLOUDINARY_CLOUD_NAME =
      "aquapay-test-cloud";
    process.env.CLOUDINARY_API_KEY = "123456789";
    process.env.CLOUDINARY_API_SECRET =
      "aquapay-test-secret";

    t.after(() => {
      for (const [key, value] of [
        ["CLOUDINARY_CLOUD_NAME", originalEnv.cloudName],
        ["CLOUDINARY_API_KEY", originalEnv.apiKey],
        ["CLOUDINARY_API_SECRET", originalEnv.apiSecret],
      ]) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    const cloudinary = getCloudinary();

    // Simulate Cloudinary upload completion.
    // No network request is made.
    mock.method(
      cloudinary.uploader,
      "upload_stream",
      (_options, callback) => ({
        end: () => {
          uploadNumber += 1;

          callback(null, {
            public_id: `aquapay/test/fresh-${uploadNumber}`,
          });
        },
      }),
    );

    const connection = {
      async beginTransaction() {
        transactions.push("begin");
      },

      async commit() {
        transactions.push("commit");
      },

      async rollback() {
        transactions.push("rollback");
      },

      release() {},

      destroy() {},

      async execute(sql, params = []) {
        const query = sql.replace(/\s+/g, " ").trim();

        // Locate and lock the merchant's pending case.
        if (
          query.includes("FROM kyc_cases") &&
          query.includes("FOR UPDATE")
        ) {
          assert.deepEqual(params, [userId]);

          return [[{
            id: caseId,
            user_id: userId,
            status: "pending",
            steps_completed: 4,
          }]];
        }

        // Check Step 4 and Step 5.
        if (
          query.includes("FROM kyc_steps") &&
          query.includes("FOR UPDATE")
        ) {
          const stepNumber = params[1];

          assert.equal(params[0], caseId);

          return [[{
            id: stepNumber,
            case_id: caseId,
            step_number: stepNumber,
            status:
              stepNumber === 4
                ? "completed"
                : step5Status,
          }]];
        }

        // Persist newly uploaded media metadata.
        if (query.startsWith("INSERT INTO media_assets")) {
          assert.equal(params[0], caseId);
          assert.equal(params[2], "cloudinary");

          assets.push({
            id: nextMediaId,
            case_id: caseId,
            asset_type: params[1],
            status: "uploaded",
            storage_key: params[3],
          });

          return [{ insertId: nextMediaId++ }];
        }

        // The real model counts active distinct media types.
        if (
          query.includes("COUNT(DISTINCT asset_type)") &&
          query.includes("AS uploaded_count")
        ) {
          assert.match(
            query,
            /status IN \('uploaded', 'verified'\)/,
          );

          assert.match(
            query,
            /asset_type IN \('shop_image', 'selfie', 'consent_video'\)/,
          );

          const requiredTypes = new Set([
            "shop_image",
            "selfie",
            "consent_video",
          ]);

          const count = new Set(
            assets
              .filter(
                (asset) =>
                  asset.case_id === params[0] &&
                  asset.status === "uploaded" &&
                  requiredTypes.has(asset.asset_type),
              )
              .map((asset) => asset.asset_type),
          ).size;

          return [[{ uploaded_count: count }]];
        }

        // Complete Step 5.
        if (
          query.startsWith("UPDATE kyc_steps") &&
          query.includes("step_number = 5")
        ) {
          assert.equal(params[0], caseId);
          assert.equal(step5Status, "pending");
          assert.equal(assets.length, 3);

          step5Status = "completed";
          return [{ affectedRows: 1 }];
        }

        // Recalculate completed step count.
        if (
          query.includes("COUNT(*) AS steps_completed")
        ) {
          return [[{
            steps_completed:
              step5Status === "completed" ? 5 : 4,
          }]];
        }

        // Persist recalculated KYC progress.
        if (query.startsWith("UPDATE kyc_cases")) {
          assert.equal(params[1], caseId);
          return [{ affectedRows: 1 }];
        }

        throw new Error(`Unexpected SQL: ${query}`);
      },
    };

    mock.method(
      pool,
      "getConnection",
      async () => connection,
    );

    function makeFile(mimeType) {
      const buffer = Buffer.from("test-media-content");

      return {
        buffer,
        size: buffer.length,
        detectedMimeType: mimeType,
      };
    }

    // First fresh asset: shop image.
    const shopResult = await uploadMedia(
      userId,
      "shop_image",
      makeFile("image/jpeg"),
    );

    assert.equal(shopResult.allUploadsComplete, false);
    assert.equal(shopResult.steps_completed, 4);
    assert.equal(step5Status, "pending");

    // Second fresh asset: selfie.
    const selfieResult = await uploadMedia(
      userId,
      "selfie",
      makeFile("image/jpeg"),
    );

    assert.equal(selfieResult.allUploadsComplete, false);
    assert.equal(selfieResult.steps_completed, 4);
    assert.equal(step5Status, "pending");

    // Third fresh asset: consent video.
    const videoResult = await uploadMedia(
      userId,
      "consent_video",
      makeFile("video/mp4"),
    );

    assert.equal(videoResult.allUploadsComplete, true);
    assert.equal(videoResult.steps_completed, 5);
    assert.equal(step5Status, "completed");

    assert.deepEqual(
      assets.map((asset) => asset.asset_type),
      ["shop_image", "selfie", "consent_video"],
    );

    assert.equal(
      new Set(
        assets.map((asset) => asset.storage_key),
      ).size,
      3,
    );

    // Each upload performs an eligibility transaction
    // and a separate persistence transaction.
    assert.equal(
      transactions.filter((event) => event === "begin")
        .length,
      6,
    );

    assert.equal(
      transactions.filter((event) => event === "commit")
        .length,
      6,
    );

    assert.equal(
      transactions.filter((event) => event === "rollback")
        .length,
      0,
    );
  },
);