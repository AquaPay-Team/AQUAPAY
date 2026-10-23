import basicDetailsModel from "./basicDetails.model.js";
import { invalidateStatus } from "../status/status.service.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

async function saveBasicDetails(userId, { businessType, shopAddress, city, pincode }) {
  let connection;

  try {
    connection = await basicDetailsModel.getConnection();
  } catch {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "KYC service is temporarily unavailable",
      [],
      "SERVICE_UNAVAILABLE",
    );
  }

  try {
    await connection.beginTransaction();

    // 1. Verify user exists
    const user = await basicDetailsModel.findUserById(connection, userId);
    if (!user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "User not found",
        [],
        "NOT_FOUND",
      );
    }

    // 2. Retrieve existing KYC case
    let existingCase = await basicDetailsModel.findCaseByUserId(connection, userId);
    let caseId;
    let caseStatus = "draft";
    let currentStep = 1;

    if (existingCase) {
      if (existingCase.status !== "draft") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Cannot update basic details for a case with status: ${existingCase.status}`,
          [],
          "CASE_NOT_EDITABLE",
        );
      }
      caseId = existingCase.id;
      caseStatus = existingCase.status;
      currentStep = existingCase.current_step;
      await basicDetailsModel.updateCaseBusinessType(connection, caseId, businessType);
    } else {
      caseId = await basicDetailsModel.createCase(connection, {
        userId,
        businessType,
      });
      caseStatus = "draft";
      currentStep = 1;
    }

    // 3. Initialize or update step progress
    const existingSteps = await basicDetailsModel.findStepsByCaseId(connection, caseId);
    const stepMap = new Map(existingSteps.map((s) => [s.step_number, s]));

    // Step 1: Basic Details
    if (!stepMap.has(1)) {
      await basicDetailsModel.insertStep(connection, {
        caseId,
        stepNumber: 1,
        status: "completed",
        completedAt: new Date(),
      });
    } else {
      const step1 = stepMap.get(1);
      if (step1.status !== "completed") {
        await basicDetailsModel.updateStep(connection, {
          caseId,
          stepNumber: 1,
          status: "completed",
          completedAt: new Date(),
        });
      }
    }

    // Steps 2 to 7: initialize missing steps as pending, preserve completed or in-progress steps
    for (let stepNumber = 2; stepNumber <= 7; stepNumber++) {
      if (!stepMap.has(stepNumber)) {
        await basicDetailsModel.insertStep(connection, {
          caseId,
          stepNumber,
          status: "pending",
          completedAt: null,
        });
      }
    }

    // 4. Update address fields in users table (without touching name, email, mobile, shopname, or state)
    await basicDetailsModel.updateUserAddress(connection, userId, {
      shopAddress,
      city,
      pincode,
    });

    // 5. Commit transaction
    await connection.commit();

    // 6. Invalidate KYC status cache only after successful commit
    try {
      invalidateStatus(userId);
    } catch {
      // Non-fatal if cache invalidation fails
    }

    return {
      businessType,
      shopAddress,
      city,
      pincode,
      caseStatus,
      currentStep,
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Rollback failure handled
      }
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "KYC service is temporarily unavailable",
      [],
      "SERVICE_UNAVAILABLE",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

const basicDetailsService = {
  saveBasicDetails,
};

export { saveBasicDetails };
export default basicDetailsService;
