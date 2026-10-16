
const { test } = require("node:test");
const assert = require("node:assert/strict");

const authorizationModel = require("./authorization.model");
const authorizationService = require("./authorization.service");

test("allows creating a descendant role", async () => {
  const original = authorizationModel.isRoleBelow;

  authorizationModel.isRoleBelow = async (actorId, targetId) => {
    return actorId === 3 && [4, 5, 8].includes(targetId);
  };

  try {
    assert.equal(
      await authorizationService.canCreateRole(3, 4),
      true
    );

    assert.equal(
      await authorizationService.canCreateRole(3, 8),
      true
    );
  } finally {
    authorizationModel.isRoleBelow = original;
  }
});

test("denies creating the same role", async () => {
  assert.equal(
    await authorizationService.canCreateRole(3, 3),
    false
  );
});

test("denies missing role IDs", async () => {
  assert.equal(
    await authorizationService.canCreateRole(null, 4),
    false
  );
});
