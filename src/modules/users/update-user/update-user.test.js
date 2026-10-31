import assert from "node:assert/strict";
import { test } from "node:test";
import pool from "../../../config/db.js";
import userModel from "../user.model.js";
import updateUserService from "./update-user.service.js";
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
test("update-user validator: rejects an invalid pincode", () => {
  const { error } = runValidator({
    pincode: "12345",
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "VALIDATION_ERROR");
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

function createMockConnection({
  rollbackError = null,
  releaseError = null,
  destroyError = null,
} = {}) {
  const calls = [];

  return {
    calls,
    connection: {
      async beginTransaction() {
        calls.push("begin");
      },

      async commit() {
        calls.push("commit");
      },

      async rollback() {
        calls.push("rollback");

        if (rollbackError) {
          throw rollbackError;
        }
      },

      release() {
        calls.push("release");

        if (releaseError) {
          throw releaseError;
        }
      },

      destroy() {
        calls.push("destroy");

        if (destroyError) {
          throw destroyError;
        }
      },
    },
  };
}

function mockUpdateUserDependencies({
  actor = { id: 1, role_id: 1 },
  currentUser = {
    id: 10,
    email: "old@example.com",
    mobile: "+919876543210",
  },
  duplicate = null,
  updatedUser = {
    id: 10,
    name: "Updated User",
    email: "old@example.com",
  },
  updateError = null,
  rollbackError = null,
  releaseError = null,
  destroyError = null,
} = {}) {
  const mock = createMockConnection({
    rollbackError,
    releaseError,
    destroyError,
  });

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findUserSafeById: userModel.findUserSafeById,
    checkDuplicateUser: userModel.checkDuplicateUser,
    updateUserFields: userModel.updateUserFields,
  };

  let profileFetchCount = 0;
  let updateArguments = null;

  pool.getConnection = async () => mock.connection;

  userModel.findUserForAuth = async () => actor;

  userModel.findUserSafeById = async () => {
    profileFetchCount += 1;
    return profileFetchCount === 1 ? currentUser : updatedUser;
  };

  userModel.checkDuplicateUser = async () => duplicate;

  userModel.updateUserFields = async (...args) => {
    updateArguments = args;

    if (updateError) {
      throw updateError;
    }

    return true;
  };

  return {
    ...mock,

    get updateArguments() {
      return updateArguments;
    },

    restore() {
      pool.getConnection = originals.getConnection;
      userModel.findUserForAuth = originals.findUserForAuth;
      userModel.findUserSafeById = originals.findUserSafeById;
      userModel.checkDuplicateUser = originals.checkDuplicateUser;
      userModel.updateUserFields = originals.updateUserFields;
    },
  };
}

test("update-user service: rejects an invalid target ID", async () => {
  await assert.rejects(
    updateUserService.updateUser({
      actorId: 1,
      targetUserId: "invalid",
      fields: { city: "Vadodara" },
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );
});
test("update-user service: rejects an actor who does not exist", async () => {
  const mock = mockUpdateUserDependencies({
    actor: null,
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 999,
        targetUserId: 10,
        fields: { city: "Vadodara" },
      }),
      (error) => {
        assert.equal(error.statusCode, 401);
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);
  } finally {
    mock.restore();
  }
});
test("update-user service: returns 404 when target user does not exist", async () => {
  const mock = mockUpdateUserDependencies({
    currentUser: null,
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 999,
        fields: { city: "Vadodara" },
      }),
      (error) => {
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);

    assert.equal(mock.updateArguments, null);
  } finally {
    mock.restore();
  }
});

test("update-user service: rejects a non-admin and rolls back", async () => {
  const mock = mockUpdateUserDependencies({
    actor: { id: 5, role_id: 2 },
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 5,
        targetUserId: 10,
        fields: { city: "Vadodara" },
      }),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "FORBIDDEN");
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);
  } finally {
    mock.restore();
  }
});

test("update-user service: updates permitted fields and commits", async () => {
  const mock = mockUpdateUserDependencies({
    updatedUser: {
      id: 10,
      name: "Updated User",
      city: "Vadodara",
    },
  });

  const fields = { city: "Vadodara" };

  try {
    const result = await updateUserService.updateUser({
      actorId: 1,
      targetUserId: 10,
      fields,
    });

    assert.deepEqual(result, {
      id: 10,
      name: "Updated User",
      city: "Vadodara",
    });

    assert.equal(mock.updateArguments[0], 10);
    assert.deepEqual(mock.updateArguments[1], fields);
    assert.equal(mock.updateArguments[2], mock.connection);

    assert.deepEqual(mock.calls, ["begin", "commit", "release"]);
  } finally {
    mock.restore();
  }
});

test("update-user service: rejects an unchanged email", async () => {
  const mock = mockUpdateUserDependencies();

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 10,
        fields: { email: "OLD@example.com" },
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "VALIDATION_ERROR");
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);
  } finally {
    mock.restore();
  }
});

test("update-user service: rejects duplicate email and rolls back", async () => {
  const mock = mockUpdateUserDependencies({
    duplicate: {
      id: 20,
      email: "taken@example.com",
      mobile: "+919876543211",
    },
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 10,
        fields: { email: "taken@example.com" },
      }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "DUPLICATE_ENTRY");
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);
  } finally {
    mock.restore();
  }
});
test("update-user service: rejects duplicate mobile and rolls back", async () => {
  const mock = mockUpdateUserDependencies({
    duplicate: {
      id: 20,
      email: "other@example.com",
      mobile: "+919876543211",
    },
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 10,
        fields: { mobile: "+919876543211" },
      }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "DUPLICATE_ENTRY");
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);

    assert.equal(mock.updateArguments, null);
  } finally {
    mock.restore();
  }
});

test("update-user service: rolls back when the database update fails", async () => {
  const mock = mockUpdateUserDependencies({
    updateError: new Error("Simulated database failure"),
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 10,
        fields: { city: "Vadodara" },
      }),
      /Simulated database failure/,
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);
  } finally {
    mock.restore();
  }
});

test("update-user service: preserves the original error and destroys the connection when rollback fails", async () => {
  const updateError = new Error("Simulated database update failure");
  const rollbackError = new Error("Simulated rollback failure");

  const mock = mockUpdateUserDependencies({
    updateError,
    rollbackError,
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 10,
        fields: { city: "Vadodara" },
      }),
      (error) => {
        assert.strictEqual(error, updateError);
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "destroy"]);
  } finally {
    mock.restore();
  }
});
test("update-user validator: converts empty optional fields to null", () => {
  const { req, error } = runValidator({
    shopname: "",
    address: null,
    state: "",
    city: "",
    pincode: null,
  });

  assert.equal(error, undefined);

  assert.deepEqual(req.validatedBody, {
    shopname: null,
    address: null,
    state: null,
    city: null,
    pincode: null,
  });
});
test("update-user validator: rejects protected and unknown fields", () => {
  const protectedFields = [
    { status: "inactive" },
    { company_id: 2 },
    { parent_id: 5 },
    { role_id: 1 },
  ];

  for (const body of protectedFields) {
    const { error } = runValidator(body);

    assert.ok(error);
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, "VALIDATION_ERROR");
  }
});
test("update-user service: converts database duplicate-key errors to 409", async () => {
  const duplicateError = new Error("Duplicate entry");
  duplicateError.code = "ER_DUP_ENTRY";

  const mock = mockUpdateUserDependencies({
    updateError: duplicateError,
  });

  try {
    await assert.rejects(
      updateUserService.updateUser({
        actorId: 1,
        targetUserId: 10,
        fields: { email: "taken@example.com" },
      }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "DUPLICATE_ENTRY");
        return true;
      },
    );

    assert.deepEqual(mock.calls, ["begin", "rollback", "release"]);
  } finally {
    mock.restore();
  }
});
