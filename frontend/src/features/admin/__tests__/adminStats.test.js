import { describe, it, expect } from "vitest";
import { computeUserStats } from "../hooks/useAdminUsers";

describe("computeUserStats", () => {
  it("returns zeroed counts for empty or non-array input", () => {
    expect(computeUserStats([])).toEqual({
      total: 0,
      active: 0,
      retailers: 0,
      distributors: 0,
      pendingKyc: 0,
      verifiedKyc: 0,
    });
    expect(computeUserStats(null)).toEqual({
      total: 0,
      active: 0,
      retailers: 0,
      distributors: 0,
      pendingKyc: 0,
      verifiedKyc: 0,
    });
  });

  it("correctly aggregates total, active, retailers, distributors, and KYC statuses", () => {
    const mockUsers = [
      { id: 1, status: "active", role_name: "Retailer", kyc: { status: "verified" } },
      { id: 2, status: "active", role_slug: "RT", kyc: { status: "completed" } },
      { id: 3, status: "inactive", role_name: "Distributor", kyc: { status: "pending" } },
      { id: 4, status: "active", role_slug: "DT", kyc: { status: "submitted" } },
      { id: 5, status: "active", role_name: "Master Distributor", kyc: null },
    ];

    const stats = computeUserStats(mockUsers);

    expect(stats.total).toBe(5);
    expect(stats.active).toBe(4);
    expect(stats.retailers).toBe(2);
    expect(stats.distributors).toBe(2);
    expect(stats.pendingKyc).toBe(2); // user 3 (pending) and user 5 (null)
    expect(stats.verifiedKyc).toBe(3); // users 1, 2, and 4
  });
});