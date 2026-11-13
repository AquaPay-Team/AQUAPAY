import { test } from "node:test";
import assert from "node:assert/strict";

import authorizationModel from "./authorization.model.js";
import authorizationService from "./authorization.service.js";

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
