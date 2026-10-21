import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeMobile,
  isValidMobile,
  isValidShopname,
  isValidAddress,
  isValidPincode,
} from "../../utils/validationHelper.js";
import { validateCreateUser } from "./user.validator.js";

function runValidator(body) {
  const req = { body };
  let error = null;
  validateCreateUser(req, {}, (err) => {
    error = err;
  });
  return { req, error };
}

test("validationHelper: normalizes mobile and validates Indian format", () => {
  // Normal 10-digit number
  assert.equal(normalizeMobile("9876543210"), "+919876543210");
  assert.equal(isValidMobile("9876543210"), true);

  // Number with +91
  assert.equal(normalizeMobile("+919876543210"), "+919876543210");
  assert.equal(isValidMobile("+919876543210"), true);

  // Number with leading 0
  assert.equal(normalizeMobile("09876543210"), "+919876543210");
  assert.equal(isValidMobile("09876543210"), true);

  // Number starting with invalid digit (< 6)
  assert.equal(isValidMobile("5876543210"), false);
  assert.equal(isValidMobile("0000000000"), false);

  // Invalid length
  assert.equal(isValidMobile("12345"), false);
});

test("validationHelper: validates shopname, address, and pincode", () => {
  assert.equal(isValidShopname("Aqua Kirana Store"), true);
  assert.equal(isValidShopname("a".repeat(151)), false);

  assert.equal(isValidAddress("123, MG Road, Sector 4"), true);
  assert.equal(isValidAddress("a".repeat(256)), false);

  assert.equal(isValidPincode("110001"), true);
  assert.equal(isValidPincode("010001"), false); // Pincodes don't start with 0
  assert.equal(isValidPincode("12345"), false); // 5 digits
  assert.equal(isValidPincode("1234567"), false); // 7 digits
});

test("user.validator: validates user creation input and sets validatedBody", () => {
  const validBody = {
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    shopname: "John Mart",
    address: "MG Road",
    state: "Maharashtra",
    city: "Mumbai",
    pincode: "400001",
    password: "Password@123",
    roleId: "2",
  };

  const { req, error } = runValidator(validBody);
  assert.equal(error, undefined);
  assert.equal(req.validatedBody.name, "John Doe");
  assert.equal(req.validatedBody.email, "john@example.com");
  assert.equal(req.validatedBody.mobile, "+919876543210");
  assert.equal(req.validatedBody.shopname, "John Mart");
  assert.equal(req.validatedBody.roleId, 2); // Correctly parsed numeric string to Number
});

test("user.validator: rejects invalid input", () => {
  const invalidBody = {
    name: "J", // Too short
    email: "not-an-email",
    mobile: "123",
    password: "short",
    roleId: -1,
  };

  const { error } = runValidator(invalidBody);
  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("get-user service: admin gets all users, non-admin gets only created users", async () => {
  const getUserModel = (await import("./get-user/get-user.model.js")).default;
  const getUserService = (await import("./get-user/get-user.service.js")).default;

  const originalFindActorRole = getUserModel.findActorRole;
  const originalFindAllUsers = getUserModel.findAllUsers;
  const originalFindChildrenByParentId = getUserModel.findChildrenByParentId;
  const originalFindUserById = getUserModel.findUserById;
  const originalFindChildByIdAndParentId = getUserModel.findChildByIdAndParentId;

  try {
    let called = "";

    getUserModel.findActorRole = async (actorId) => {
      if (actorId === 1) return { id: 1, role_id: 1, role_slug: "AD" }; // Admin
      return { id: 5, role_id: 7, role_slug: "DT" }; // Distributor
    };

    getUserModel.findAllUsers = async () => {
      called = "findAllUsers";
      return [{ id: 10, name: "User 10" }, { id: 20, name: "User 20" }];
    };

    getUserModel.findChildrenByParentId = async (parentId) => {
      called = `findChildren_${parentId}`;
      return [{ id: 20, name: "User 20", parent_id: parentId }];
    };

    getUserModel.findUserById = async (id) => {
      called = `findUserById_${id}`;
      return { id, name: `User ${id}` };
    };

    getUserModel.findChildByIdAndParentId = async (childId, parentId) => {
      called = `findChild_${childId}_parent_${parentId}`;
      return { id: childId, parent_id: parentId };
    };

    // 1. Admin gets all users
    const adminUsers = await getUserService.getUsers(1);
    assert.equal(called, "findAllUsers");
    assert.equal(adminUsers.length, 2);

    // 2. Non-admin gets only their children
    const nonAdminUsers = await getUserService.getUsers(5);
    assert.equal(called, "findChildren_5");
    assert.equal(nonAdminUsers.length, 1);

    // 3. Admin gets any user by ID
    const userForAdmin = await getUserService.getUserById(1, 99);
    assert.equal(called, "findUserById_99");
    assert.equal(userForAdmin.id, 99);

    // 4. Non-admin gets child user by ID
    const userForNonAdmin = await getUserService.getUserById(5, 20);
    assert.equal(called, "findChild_20_parent_5");
    assert.equal(userForNonAdmin.id, 20);
  } finally {
    getUserModel.findActorRole = originalFindActorRole;
    getUserModel.findAllUsers = originalFindAllUsers;
    getUserModel.findChildrenByParentId = originalFindChildrenByParentId;
    getUserModel.findUserById = originalFindUserById;
    getUserModel.findChildByIdAndParentId = originalFindChildByIdAndParentId;
  }
});
