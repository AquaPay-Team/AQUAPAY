import { describe, it, expect } from "vitest";
import { ROUTES } from "../paths";

describe("ROUTES definition hygiene", () => {
  it("defines standard path strings starting with /", () => {
    expect(typeof ROUTES).toBe("object");
    expect(Object.keys(ROUTES).length).toBeGreaterThan(0);

       for (const path of Object.values(ROUTES)) {
      expect(typeof path).toBe("string");
      expect(path.startsWith("/")).toBe(true);
      expect(path.trim()).toBe(path);
    }
  });

  it("contains core critical navigation paths", () => {
    expect(ROUTES.LOGIN).toBe("/login");
    expect(ROUTES.USER_DASHBOARD).toBe("/user/dashboard");
    expect(ROUTES.ADMIN_DASHBOARD).toBe("/admin/dashboard");
    expect(ROUTES.ADMIN_USERS).toBe("/admin/users");
    expect(ROUTES.ADMIN_KYC).toBe("/admin/kyc");
  });
});