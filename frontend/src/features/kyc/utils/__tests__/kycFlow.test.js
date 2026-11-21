import { describe, it, expect } from "vitest";
import { interpretKycStatus } from "../kycFlow.js";

describe("interpretKycStatus", () => {
  it("returns initial wizard state when hasCase is false", () => {
    const result = interpretKycStatus({ hasCase: false });
    expect(result).toEqual({
      status: "pending",
      view: "wizard",
      completedSteps: [],
      currentStep: 1,
    });
  });

  it("handles approved statuses: approved, completed, verified", () => {
    for (const status of ["approved", "completed", "verified"]) {
      const result = interpretKycStatus({
        hasCase: true,
        status,
        completedSteps: [1, 2, 3, 4, 5, 6, 7],
      });
      expect(result.view).toBe("approved");
      expect(result.status).toBe(status);
      expect(result.currentStep).toBeNull();
    }
  });

  it("handles submitted statuses: submitted, under_review", () => {
    for (const status of ["submitted", "under_review"]) {
      const result = interpretKycStatus({
        hasCase: true,
        status,
        completedSteps: [1, 2, 3, 4, 5, 6, 7],
      });
      expect(result.view).toBe("submitted");
      expect(result.status).toBe(status);
      expect(result.currentStep).toBeNull();
    }
  });

  it("handles rejected status and routes to step 5", () => {
    const result = interpretKycStatus({
      hasCase: true,
      status: "rejected",
      completedSteps: [1, 2, 3, 4],
    });
    expect(result.view).toBe("rejected");
    expect(result.currentStep).toBe(5);
  });

  it("picks the next pending step correctly when pending", () => {
    const result = interpretKycStatus({
      hasCase: true,
      status: "pending",
      completedSteps: [1, 2],
    });
    expect(result.view).toBe("wizard");
    expect(result.currentStep).toBe(3);
  });

  it("throws an error if status is pending but step 7 is already marked completed", () => {
    expect(() =>
      interpretKycStatus({
        hasCase: true,
        status: "pending",
        completedSteps: [1, 2, 3, 4, 5, 6, 7],
      })
    ).toThrow(/inconsistent/i);
  });

  it("throws an error for null or invalid inputs", () => {
    expect(() => interpretKycStatus(null)).toThrow();
    expect(() => interpretKycStatus({})).toThrow();
  });
});