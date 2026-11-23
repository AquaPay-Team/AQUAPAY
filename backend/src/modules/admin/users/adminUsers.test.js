import assert from "node:assert/strict";
import { test } from "node:test";

import getUserModel from "../../users/get-user/get-user.model.js";
import adminUsersService from "./adminUsers.service.js";
import { getAdminUsersController } from "./adminUsers.controller.js";
import { getAdminUsers } from "./adminUsers.service.js";

function mockDirectory(t, result = { users: [], total: 0 }) {
  const original = getUserModel.findAdminUsersPage;
  let capturedOptions;

  getUserModel.findAdminUsersPage = async (options) => {
    capturedOptions = options;
    return result;
  };

  t.after(() => {
    getUserModel.findAdminUsersPage = original;
  });

  return () => capturedOptions;
}

test("admin users defaults to a first page of 25 newest users", async (t) => {
  const getOptions = mockDirectory(t, {
    users: [{ id: 25, name: "Newest user" }],
    total: 26,
  });

  const result = await getAdminUsers();

  assert.deepEqual(getOptions(), {
    userId: null,
    nameSearch: null,
    status: null,
    roleId: undefined,
    registeredFrom: null,
    registeredTo: null,
    page: 1,
    limit: 25,
  });
  assert.deepEqual(result.pagination, {
    page: 1,
    limit: 25,
    total: 26,
    totalPages: 2,
    hasNextPage: true,
    hasPreviousPage: false,
  });
});

test("admin users maps exact numeric search, filters, and ISO date ranges", async (t) => {
  const getOptions = mockDirectory(t, { users: [], total: 0 });

  await getAdminUsers({
    page: "2",
    limit: "100",
    search: " 42 ",
    status: "blocked",
    roleId: "1",
    registeredFrom: "2026-11-01T00:00:00.000Z",
    registeredTo: "2026-12-01T00:00:00+00:00",
  });

  const options = getOptions();
  assert.equal(options.userId, 42);
  assert.equal(options.nameSearch, null);
  assert.equal(options.status, "blocked");
  assert.equal(options.roleId, 1);
  assert.equal(options.page, 2);
  assert.equal(options.limit, 100);
  assert.equal(options.registeredFrom.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(options.registeredTo.toISOString(), "2026-12-01T00:00:00.000Z");
});

test("admin users maps non-numeric search to a trimmed name search", async (t) => {
  const getOptions = mockDirectory(t, { users: [], total: 0 });

  await getAdminUsers({ search: "  Asha Sharma  " });

  assert.equal(getOptions().userId, null);
  assert.equal(getOptions().nameSearch, "Asha Sharma");
});

test("admin users rejects invalid pagination, account filters, and query values", async (t) => {
  mockDirectory(t);

  const invalidQueries = [
    [{ page: "0" }, /page must be a positive integer/],
    [{ limit: "101" }, /limit must be a positive integer no greater than 100/],
    [{ status: "suspended" }, /status must be active, inactive, or blocked/],
    [{ roleId: "0" }, /roleId must be a positive integer/],
    [{ search: "0" }, /search User ID must be a positive integer/],
    [{ search: ["Asha", "Bina"] }, /search must be provided once/],
    [{ registeredFrom: "2026-11-01" }, /registeredFrom must be an ISO-8601 instant/],
    [{ registeredFrom: "2026-02-30T00:00:00.000Z" }, /registeredFrom must be an ISO-8601 instant/],
    [{ registeredFrom: "2026-12-01T00:00:00.000Z", registeredTo: "2026-12-01T00:00:00.000Z" }, /registeredFrom must be before registeredTo/],
  ];

  for (const [query, message] of invalidQueries) {
    await assert.rejects(getAdminUsers(query), message);
  }
});

test("admin users controller returns the standard success envelope", async (t) => {
  const original = adminUsersService.getAdminUsers;
  adminUsersService.getAdminUsers = async () => ({
    users: [{ id: 42, name: "Asha Sharma" }],
    pagination: { page: 1, limit: 25, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
  });

  t.after(() => {
    adminUsersService.getAdminUsers = original;
  });

  let responseStatus;
  let responseBody;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await getAdminUsersController({ query: {} }, res, () => {});

  assert.equal(responseStatus, 200);
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.message, "Users fetched successfully");
  assert.equal(responseBody.data.users[0].id, 42);
});
