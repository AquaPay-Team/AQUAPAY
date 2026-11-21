import { describe, it, expect } from "vitest";
import { isAdminRole, isNormalUserRole } from "../roles.js";

describe("Role Utilities", () => {
  it("identifies Admin role correctly", () => {
    expect(isAdminRole({ role_id: 1 })).toBe(true);
    expect(isAdminRole({ slug: "AD" })).toBe(true);
    expect(isAdminRole(1)).toBe(true);
    expect(isAdminRole("AD")).toBe(true);
    expect(isAdminRole("Admin")).toBe(true);
  });

  it("returns false for non-admin roles in isAdminRole", () => {
    expect(isAdminRole({ role_id: 2 })).toBe(false);
    expect(isAdminRole({ slug: "RT" })).toBe(false);
    expect(isAdminRole(8)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it("identifies Normal User roles (Level 1-7 / Roles 2-8)", () => {
    // Roles 2 to 8 should all return true
    for (let id = 2; id <= 8; id++) {
      expect(isNormalUserRole(id)).toBe(true);
      expect(isNormalUserRole({ role_id: id })).toBe(true);
    }
  });

  it("returns false for Admin in isNormalUserRole", () => {
    expect(isNormalUserRole(1)).toBe(false);
    expect(isNormalUserRole({ role_id: 1 })).toBe(false);
    expect(isNormalUserRole({ slug: "AD" })).toBe(false);
  });
});