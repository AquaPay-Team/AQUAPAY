import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET = "unit-test-secret-that-is-longer-than-32-characters";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "1";
process.env.DB_USER = "unit_test_user";
process.env.DB_PASSWORD = "unit-test-only-password";
process.env.DB_NAME = "auth_unit_test_database";

import getUserModel from "./get-user.model.js";
import getUserService from "./get-user.service.js";

test("getUserById rejects invalid or non-numeric target user ID", async () => {
  await assert.rejects(
    () => getUserService.getUserById("1", "abc"),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, "VALIDATION_ERROR");
      return true;
    }
  );
});

test("getUserById returns child user if created by the parent", async () => {
  const originalFind = getUserModel.findChildByIdAndParentId;

  getUserModel.findChildByIdAndParentId = async (childId, parentId) => {
    return {
      id: childId,
      name: "Created Child",
      role_id: 8,
      parent_id: parentId,
      status: "active",
    };
  };

  try {
    const child = await getUserService.getUserById(10, 25);
    assert.equal(child.id, 25);
    assert.equal(child.parent_id, 10);
    assert.equal(child.name, "Created Child");
  } finally {
    getUserModel.findChildByIdAndParentId = originalFind;
  }
});

test("getUserById returns 404 if child not created by this parent", async () => {
  const originalFind = getUserModel.findChildByIdAndParentId;

  getUserModel.findChildByIdAndParentId = async () => null;

  try {
    await assert.rejects(
      () => getUserService.getUserById(10, 99),
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        return true;
      }
    );
  } finally {
    getUserModel.findChildByIdAndParentId = originalFind;
  }
});

test("getUsers returns all created children of the parent", async () => {
  const originalFindChildren = getUserModel.findChildrenByParentId;

  getUserModel.findChildrenByParentId = async (parentId) => {
    return [
      { id: 25, name: "Child 1", parent_id: parentId },
      { id: 26, name: "Child 2", parent_id: parentId },
    ];
  };

  try {
    const children = await getUserService.getUsers(10);
    assert.equal(children.length, 2);
    assert.equal(children[0].parent_id, 10);
    assert.equal(children[1].parent_id, 10);
  } finally {
    getUserModel.findChildrenByParentId = originalFindChildren;
  }
});
