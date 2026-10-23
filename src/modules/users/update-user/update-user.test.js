
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateUpdateUser } from "./update-user.validator.js";

function runValidator(body) {
  const req = { body };
  let error;

  validateUpdateUser(req, {}, (nextError) => {
    error = nextError;
  });

  return { req, error };
}

test("update-user validator: accepts a valid partial update", () => {
  const { req, error } = runValidator({
    city: "Vadodara",
  });

  assert.equal(error, undefined);
  assert.deepEqual(req.validatedBody, {
    city: "Vadodara",
  });
});

test("update-user validator: normalizes email to lowercase", () => {
  const { req, error } = runValidator({
    email: "  Rahul@example.com  ",
  });

  assert.equal(error, undefined);
  assert.equal(req.validatedBody.email, "rahul@example.com");
});

test("update-user validator: normalizes mobile number", () => {
  const { req, error } = runValidator({
    mobile: "9876543210",
  });

  assert.equal(error, undefined);
  assert.equal(req.validatedBody.mobile, "+919876543210");
});

test("update-user validator: rejects an empty request body", () => {
  const { error } = runValidator({});

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects a missing request body", () => {
  const { error } = runValidator(undefined);

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects protected fields", () => {
  const { error } = runValidator({
    role_id: 1,
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects password updates", () => {
  const { error } = runValidator({
    password: "NewPassword@123",
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects an empty email", () => {
  const { error } = runValidator({
    email: "   ",
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects an invalid email", () => {
  const { error } = runValidator({
    email: "not-an-email",
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects an email longer than 254 characters", () => {
  const { error } = runValidator({
    email: `${"a".repeat(243)}@example.com`,
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects an invalid mobile number", () => {
  const { error } = runValidator({
    mobile: "123",
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: rejects an invalid name", () => {
  const { error } = runValidator({
    name: "J",
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("update-user validator: accepts multiple permitted fields", () => {
  const { req, error } = runValidator({
    name: "Rahul Sharma",
    email: "rahul@example.com",
    city: "Vadodara",
    pincode: "390007",
  });

  assert.equal(error, undefined);
  assert.deepEqual(req.validatedBody, {
    name: "Rahul Sharma",
    email: "rahul@example.com",
    city: "Vadodara",
    pincode: "390007",
  });
});
