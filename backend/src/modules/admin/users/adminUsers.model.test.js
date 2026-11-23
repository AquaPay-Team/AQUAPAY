import assert from "node:assert/strict";
import { test } from "node:test";

import pool from "../../../config/db.js";
import { findAdminUsersPage } from "../../users/get-user/get-user.model.js";

test("admin users model applies all filters, sorts by registration time, and paginates", async (t) => {
  const originalExecute = pool.execute;
  const calls = [];

  pool.execute = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return [[{ total: 26 }]];
    return [[{
      id: 42,
      name: "Asha Sharma",
      status: "active",
      role_id: 7,
      role_name: "Distributor",
      role_slug: "DT",
      kyc_case_id: null,
      created_at: new Date("2026-11-23T09:30:00.000Z"),
    }]];
  };

  t.after(() => {
    pool.execute = originalExecute;
  });

  const from = new Date("2026-11-01T00:00:00.000Z");
  const to = new Date("2026-12-01T00:00:00.000Z");
  const result = await findAdminUsersPage({
    userId: 42,
    nameSearch: null,
    status: "active",
    roleId: 7,
    registeredFrom: from,
    registeredTo: to,
    page: 2,
    limit: 25,
  });

  assert.equal(result.total, 26);
  assert.equal(result.users.length, 1);
  assert.equal(result.users[0].kyc, null);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /u\.id = \?/);
  assert.match(calls[0].sql, /u\.status = \?/);
  assert.match(calls[0].sql, /u\.role_id = \?/);
  assert.match(calls[0].sql, /u\.created_at >= \?/);
  assert.match(calls[0].sql, /u\.created_at < \?/);
  assert.match(calls[1].sql, /ORDER BY u\.created_at DESC, u\.id DESC/);
  assert.match(calls[1].sql, /LIMIT \? OFFSET \?/);
  assert.doesNotMatch(calls[1].sql, /password_hash|reset_token|account_number/i);
  assert.deepEqual(calls[0].params, [42, "active", 7, from, to]);
  assert.deepEqual(calls[1].params, [42, "active", 7, from, to, 25, 25]);
});

test("admin users model searches names only when no exact user ID is requested", async (t) => {
  const originalExecute = pool.execute;
  const calls = [];

  pool.execute = async (sql, params) => {
    calls.push({ sql, params });
    return calls.length === 1 ? [[{ total: 0 }]] : [[]];
  };

  t.after(() => {
    pool.execute = originalExecute;
  });

  await findAdminUsersPage({
    userId: null,
    nameSearch: "Asha",
    status: null,
    roleId: undefined,
    registeredFrom: null,
    registeredTo: null,
    page: 1,
    limit: 25,
  });

  assert.match(calls[0].sql, /u\.name LIKE \?/);
  assert.deepEqual(calls[0].params, ["%Asha%"]);
  assert.deepEqual(calls[1].params, ["%Asha%", 25, 0]);
});
