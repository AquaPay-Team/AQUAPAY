import assert from "node:assert/strict";
import express from "express";
import { after, test } from "node:test";

import uploadSingleMedia from "./mediaUpload.middleware.js";
import { uploadMedia } from "./media.service.js";
import { errorHandler } from "../../../middlewares/error.middleware.js";

let server;
let baseUrl;

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function startTestServer() {
  const app = express();

  app.post("/upload", uploadSingleMedia, (req, res) => {
    res.status(200).json({
      success: true,
      mimeType: req.file.detectedMimeType,
      extension: req.file.detectedExtension,
      size: req.file.size,
    });
  });

  app.use(errorHandler);

  server = app.listen(0);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function uploadFile(buffer, filename, mimeType) {
  const formData = new FormData();

  formData.append("file", new Blob([buffer], { type: mimeType }), filename);

  return fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: formData,
  });
}

test("media upload accepts a valid JPEG file", async () => {
  await startTestServer();

  const jpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  const response = await uploadFile(jpegBuffer, "shop.jpg", "image/jpeg");

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.mimeType, "image/jpeg");
  assert.equal(body.extension, "jpg");
});

test("media upload rejects a file with a spoofed MIME type", async () => {
  const fakeBuffer = Buffer.from("This is not an actual JPEG file");

  const response = await uploadFile(fakeBuffer, "fake.jpg", "image/jpeg");

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, "INVALID_FILE_CONTENT");
});

test("media upload rejects unsupported MIME types", async () => {
  const response = await uploadFile(
    Buffer.from("some content"),
    "document.pdf",
    "application/pdf",
  );

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, "INVALID_FILE_TYPE");
});

test("media upload rejects files exceeding 20 MB", async () => {
  const largeBuffer = Buffer.alloc(20 * 1024 * 1024 + 1);

  const response = await uploadFile(largeBuffer, "large.jpg", "image/jpeg");

  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.success, false);
  assert.equal(body.code, "FILE_TOO_LARGE");
});

test("media upload rejects requests without a file", async () => {
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, "FILE_REQUIRED");
});

function createMediaReplacementFixture({ failInsert = false } = {}) {
  const state = {
    assets: [
      { id: 1, assetType: "shop_image", status: "uploaded", storageKey: "old-shop" },
      { id: 2, assetType: "selfie", status: "uploaded", storageKey: "old-selfie" },
      { id: 3, assetType: "consent_video", status: "verified", storageKey: "old-video" },
    ],
    stepStatus: "completed",
    nextId: 4,
  };
  let lockTail = Promise.resolve();

  async function lockCase(connection) {
    if (connection.working) return;
    const previous = lockTail;
    let release;
    lockTail = new Promise((resolve) => { release = resolve; });
    await previous;
    connection.releaseCaseLock = release;
    connection.working = {
      assets: state.assets.map((asset) => ({ ...asset })),
      stepStatus: state.stepStatus,
    };
  }

  const model = {
    async getConnection() {
      return {
        working: null,
        async beginTransaction() {},
        async commit() {
          if (this.working) {
            state.assets = this.working.assets;
            state.stepStatus = this.working.stepStatus;
          }
          this.releaseCaseLock?.();
          this.releaseCaseLock = null;
        },
        async rollback() {
          this.releaseCaseLock?.();
          this.releaseCaseLock = null;
        },
        release() {},
        destroy() {},
      };
    },
    async findCasesByUserIdForUpdate(connection, userId) {
      assert.equal(userId, 52);
      await lockCase(connection);
      return [{ id: 13, user_id: userId, status: "pending" }];
    },
    async findStepByCaseIdAndNumber(connection, caseId, stepNumber) {
      assert.equal(caseId, 13);
      if (stepNumber === 4) return { status: "completed" };
      return { status: connection.working?.stepStatus || state.stepStatus };
    },
    async supersedeCurrentAssets(connection, caseId, assetType) {
      assert.equal(caseId, 13);
      for (const asset of connection.working.assets) {
        if (asset.assetType === assetType && ["uploaded", "verified", "rejected"].includes(asset.status)) {
          asset.status = "superseded";
        }
      }
    },
    async insertMediaAsset(connection, data) {
      if (failInsert) throw new Error("synthetic insert failure");
      const id = state.nextId++;
      connection.working.assets.push({
        id,
        assetType: data.assetType,
        status: "uploaded",
        storageKey: data.storageKey,
      });
      return id;
    },
    async hasAllRequiredMedia(connection) {
      const required = new Set(
        connection.working.assets
          .filter((asset) => ["uploaded", "verified"].includes(asset.status))
          .map((asset) => asset.assetType),
      );
      return ["shop_image", "selfie", "consent_video"].every((type) => required.has(type));
    },
    async completeStep5(connection) {
      if (connection.working.stepStatus === "completed") return false;
      connection.working.stepStatus = "completed";
      return true;
    },
    async updateCompletedStepsCount(connection) {
      return connection.working.stepStatus === "completed" ? 5 : 4;
    },
  };

  return { model, state };
}

const syntheticImage = () => ({
  buffer: Buffer.from([0xff, 0xd8, 0xff]),
  size: 3,
  detectedMimeType: "image/jpeg",
});

test("media replacement supersedes the current asset and preserves history", async () => {
  const { model, state } = createMediaReplacementFixture();
  const uploaded = [];
  const result = await uploadMedia(52, "shop_image", syntheticImage(), {
    model,
    async uploadAsset() {
      uploaded.push("new-shop");
      return { public_id: "new-shop" };
    },
    async cleanupAsset() {},
  });

  assert.equal(result.id, 4);
  assert.equal(result.allUploadsComplete, true);
  assert.deepEqual(uploaded, ["new-shop"]);
  assert.deepEqual(state.assets.filter((asset) => asset.assetType === "shop_image").map(({ id, status, storageKey }) => ({ id, status, storageKey })), [
    { id: 1, status: "superseded", storageKey: "old-shop" },
    { id: 4, status: "uploaded", storageKey: "new-shop" },
  ]);
  assert.equal(state.stepStatus, "completed");
});

test("failed media replacement rolls back the old asset and cleans only the new upload", async () => {
  const { model, state } = createMediaReplacementFixture({ failInsert: true });
  const cleaned = [];

  await assert.rejects(
    uploadMedia(52, "shop_image", syntheticImage(), {
      model,
      async uploadAsset() { return { public_id: "failed-new-shop" }; },
      async cleanupAsset(publicId) { cleaned.push(publicId); },
    }),
  );

  assert.equal(state.assets.find((asset) => asset.id === 1).status, "uploaded");
  assert.equal(state.assets.filter((asset) => asset.status === "superseded").length, 0);
  assert.deepEqual(cleaned, ["failed-new-shop"]);
});

test("media replacement cleans the uploaded asset when the database connection fails", async () => {
  const { model, state } = createMediaReplacementFixture();
  const originalGetConnection = model.getConnection;
  const cleaned = [];
  let connectionAttempts = 0;
  model.getConnection = async () => {
    connectionAttempts += 1;
    if (connectionAttempts === 2) throw new Error("synthetic connection failure");
    return originalGetConnection();
  };

  await assert.rejects(
    uploadMedia(52, "shop_image", syntheticImage(), {
      model,
      async uploadAsset() { return { public_id: "orphaned-new-shop" }; },
      async cleanupAsset(publicId) { cleaned.push(publicId); },
    }),
    (error) => error.code === "SERVICE_UNAVAILABLE",
  );

  assert.equal(state.assets.find((asset) => asset.id === 1).status, "uploaded");
  assert.deepEqual(cleaned, ["orphaned-new-shop"]);
});

test("concurrent media replacements serialize and retain both historical uploads", async () => {
  const { model, state } = createMediaReplacementFixture();
  let uploadId = 0;

  const results = await Promise.all([
    uploadMedia(52, "shop_image", syntheticImage(), {
      model,
      async uploadAsset() { uploadId += 1; return { public_id: `concurrent-${uploadId}` }; },
      async cleanupAsset() {},
    }),
    uploadMedia(52, "shop_image", syntheticImage(), {
      model,
      async uploadAsset() { uploadId += 1; return { public_id: `concurrent-${uploadId}` }; },
      async cleanupAsset() {},
    }),
  ]);

  assert.equal(results.length, 2);
  const shopAssets = state.assets.filter((asset) => asset.assetType === "shop_image");
  assert.equal(shopAssets.length, 3);
  assert.equal(shopAssets.filter((asset) => asset.status === "uploaded").length, 1);
  assert.equal(shopAssets.filter((asset) => asset.status === "superseded").length, 2);
});
