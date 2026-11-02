import assert from "node:assert/strict";
import express from "express";
import { after, test } from "node:test";

import uploadSingleMedia from "./mediaUpload.middleware.js";
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
