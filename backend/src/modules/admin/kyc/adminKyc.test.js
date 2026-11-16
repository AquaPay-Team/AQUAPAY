
import assert from "node:assert/strict";
import { test } from "node:test";
import adminKycModel from "./adminKyc.model.js";
import { getKycApplications } from "./adminKyc.service.js";

test("adminKyc.service: uses submitted and under_review by default", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    let capturedStatuses = null;
    let capturedOptions = null;

    adminKycModel.findKycApplications = async (options) => {
      capturedOptions = options;
      capturedStatuses = options.statuses;
      return [{ case_id: 1, kyc_status: "submitted" }];
    };

    adminKycModel.countKycApplications = async (statuses) => {
      assert.deepEqual(statuses, ["submitted", "under_review"]);
      return 1;
    };

    const result = await getKycApplications();

    assert.deepEqual(capturedStatuses, ["submitted", "under_review"]);
    assert.equal(capturedOptions.limit, 10);
    assert.equal(capturedOptions.offset, 0);

    assert.equal(result.applications.length, 1);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.limit, 10);
    assert.equal(result.pagination.total, 1);
    assert.equal(result.pagination.totalPages, 1);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

test("adminKyc.service: filters by a valid individual status", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    let capturedStatuses = null;

    adminKycModel.findKycApplications = async ({ statuses }) => {
      capturedStatuses = statuses;
      return [];
    };

    adminKycModel.countKycApplications = async () => 0;

    const result = await getKycApplications({
      status: "approved",
    });

    assert.deepEqual(capturedStatuses, ["approved"]);
    assert.deepEqual(result.filters.statuses, ["approved"]);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

test("adminKyc.service: rejects invalid status filters", async () => {
  await assert.rejects(
    getKycApplications({ status: "pending" }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "Invalid KYC status filter");
      return true;
    },
  );
});

test("adminKyc.service: rejects invalid page numbers", async () => {
  const invalidPages = [0, -1, 1.5, "abc"];

  for (const page of invalidPages) {
    await assert.rejects(
      getKycApplications({ page }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "Page must be a positive integer");
        return true;
      },
    );
  }
});

test("adminKyc.service: rejects invalid page limits", async () => {
  const invalidLimits = [0, -1, 1.5, 101, "abc"];

  for (const limit of invalidLimits) {
    await assert.rejects(
      getKycApplications({ limit }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /Limit must be between 1 and 100/);
        return true;
      },
    );
  }
});

test("adminKyc.service: calculates pagination correctly", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    let capturedOffset = null;
    let capturedLimit = null;

    adminKycModel.findKycApplications = async (options) => {
      capturedOffset = options.offset;
      capturedLimit = options.limit;
      return [];
    };

    adminKycModel.countKycApplications = async () => 45;

    const result = await getKycApplications({
      page: 2,
      limit: 10,
    });

    assert.equal(capturedOffset, 10);
    assert.equal(capturedLimit, 10);

    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.total, 45);
    assert.equal(result.pagination.totalPages, 5);
    assert.equal(result.pagination.hasNextPage, true);
    assert.equal(result.pagination.hasPreviousPage, true);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});

test("adminKyc.service: reports no next page on the final page", async () => {
  const originalFind = adminKycModel.findKycApplications;
  const originalCount = adminKycModel.countKycApplications;

  try {
    adminKycModel.findKycApplications = async () => [];
    adminKycModel.countKycApplications = async () => 20;

    const result = await getKycApplications({
      page: 2,
      limit: 10,
    });

    assert.equal(result.pagination.hasNextPage, false);
    assert.equal(result.pagination.hasPreviousPage, true);
  } finally {
    adminKycModel.findKycApplications = originalFind;
    adminKycModel.countKycApplications = originalCount;
  }
});
