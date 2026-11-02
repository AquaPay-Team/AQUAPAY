import crypto from "node:crypto";
import pool from "../../../../config/db.js";
import { getDigiLockerSignaturePolicy } from "./digilocker.signatureConfig.js";

const PROVIDER_NAME = "idto_digilocker_v1";
const DEVELOPMENT_UNVERIFIED_PROVIDER_NAME = "idto_digilocker_v1_dev_unverified";
const ATTEMPT_TTL_MINUTES = 10;

const VERIFICATION_STEPS = Object.freeze({
  aadhaar: { stepNumber: 2, prerequisiteStep: 1 },
  pan: { stepNumber: 3, prerequisiteStep: 2 },
});

function getAuthorizationSessionReference(authorizationSessionId) {
  if (
    typeof authorizationSessionId !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(authorizationSessionId)
  ) {
    return "";
  }
  const fingerprint = crypto.createHash("sha256").update(authorizationSessionId).digest("hex");
  return `aquapay-digilocker:${fingerprint}`;
}

function createDigilockerModel({ dbPool = pool, env = process.env } = {}) {
  async function createPendingVerification(userId, verificationType) {
    const config = VERIFICATION_STEPS[verificationType];
    if (!config) throw new Error("UNSUPPORTED_KYC_VERIFICATION_TYPE");

    const authorizationSessionId = crypto.randomBytes(32).toString("base64url");
    const sessionReference = getAuthorizationSessionReference(authorizationSessionId);

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      const [users] = await connection.execute(
        `SELECT id, status
           FROM users
          WHERE id = ?
          LIMIT 1
          FOR UPDATE`,
        [userId],
      );
      if (!users[0] || users[0].status !== "active") {
        throw new Error("USER_NOT_ACTIVE");
      }

      const [cases] = await connection.execute(
        `SELECT id, user_id, status, steps_completed
           FROM kyc_cases
          WHERE user_id = ?
          ORDER BY id ASC
          LIMIT 2
          FOR UPDATE`,
        [userId],
      );
      if (cases.length === 0) throw new Error("KYC_CASE_NOT_FOUND");
      if (cases.length > 1) throw new Error("KYC_CASE_AMBIGUOUS");

      const kycCase = cases[0];
      if (kycCase.status !== "pending") throw new Error("KYC_CASE_NOT_EDITABLE");

      const [prerequisiteSteps] = await connection.execute(
        `SELECT status
           FROM kyc_steps
          WHERE case_id = ?
            AND step_number = ?
          LIMIT 1
          FOR UPDATE`,
        [kycCase.id, config.prerequisiteStep],
      );
      if (prerequisiteSteps[0]?.status !== "completed") {
        throw new Error("KYC_PREREQUISITE_NOT_COMPLETED");
      }

      const [steps] = await connection.execute(
        `SELECT id, status
           FROM kyc_steps
          WHERE case_id = ?
            AND step_number = ?
          LIMIT 1
          FOR UPDATE`,
        [kycCase.id, config.stepNumber],
      );
      if (steps.length === 0) throw new Error("KYC_STEP_NOT_INITIALIZED");

      const [verifications] = await connection.execute(
        `SELECT id, status,
                (updated_at > CURRENT_TIMESTAMP - INTERVAL ${ATTEMPT_TTL_MINUTES} MINUTE) AS active_attempt
           FROM kyc_verifications
          WHERE case_id = ?
            AND verification_type = ?
          ORDER BY id DESC
          FOR UPDATE`,
        [kycCase.id, verificationType],
      );

      if (
        verifications.some((verification) => verification.status === "verified") ||
        steps[0].status === "completed"
      ) {
        throw new Error("VERIFICATION_ALREADY_COMPLETED");
      }

      const activePending = verifications.find(
        (verification) =>
          verification.status === "pending" &&
          Number(verification.active_attempt) === 1,
      );
      if (activePending) throw new Error("VERIFICATION_IN_PROGRESS");

      let verificationId;
      const existing = verifications[0];
      if (existing) {
        verificationId = existing.id;
        await connection.execute(
          `UPDATE kyc_verifications
              SET provider = ?,
                  provider_reference = ?,
                  status = 'pending',
                  masked_identifier = NULL,
                  verified_name = NULL,
                  failure_code = NULL,
                  verified_at = NULL,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [PROVIDER_NAME, sessionReference, verificationId],
        );
      } else {
        const [inserted] = await connection.execute(
          `INSERT INTO kyc_verifications
            (case_id, verification_type, provider, provider_reference, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [kycCase.id, verificationType, PROVIDER_NAME, sessionReference],
        );
        verificationId = inserted.insertId;
      }

      await connection.execute(
        `UPDATE kyc_steps
            SET status = 'in_progress',
                completed_at = NULL,
                failure_code = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE case_id = ?
            AND step_number = ?`,
        [kycCase.id, config.stepNumber],
      );

      await connection.commit();
      return {
        userId: String(userId),
        caseId: String(kycCase.id),
        verificationId: String(verificationId),
        authorizationSessionId,
        verificationType,
        stepNumber: config.stepNumber,
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function completeVerification({
    userId,
    caseId,
    verificationId,
    authorizationSessionId,
    verificationType,
    maskedIdentifier,
    verifiedName,
    persistIdentity,
    signatureVerified = true,
  }) {
    const config = VERIFICATION_STEPS[verificationType];
    if (!config) throw new Error("UNSUPPORTED_KYC_VERIFICATION_TYPE");
    if (typeof signatureVerified !== "boolean") throw new Error("INVALID_SIGNATURE_VERIFICATION_RESULT");
    if (typeof persistIdentity !== "function") throw new Error("INVALID_IDENTITY_DATA");
    let providerName = PROVIDER_NAME;
    if (!signatureVerified) {
      const signaturePolicy = getDigiLockerSignaturePolicy(env);
      if (!signaturePolicy.developmentOnly) throw new Error("SIGNATURE_VERIFICATION_REQUIRED");
      providerName = DEVELOPMENT_UNVERIFIED_PROVIDER_NAME;
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      const [users] = await connection.execute(
        `SELECT id, status FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
        [userId],
      );
      if (!users[0] || users[0].status !== "active") {
        throw new Error("USER_NOT_ACTIVE");
      }

      const [cases] = await connection.execute(
        `SELECT id, status FROM kyc_cases
          WHERE id = ? AND user_id = ?
          LIMIT 1 FOR UPDATE`,
        [caseId, userId],
      );
      if (!cases[0]) throw new Error("KYC_CASE_NOT_FOUND");
      if (cases[0].status !== "pending") throw new Error("KYC_CASE_NOT_EDITABLE");

      const [prerequisiteSteps] = await connection.execute(
        `SELECT status FROM kyc_steps
          WHERE case_id = ? AND step_number = ?
          LIMIT 1 FOR UPDATE`,
        [caseId, config.prerequisiteStep],
      );
      if (prerequisiteSteps[0]?.status !== "completed") {
        throw new Error("KYC_PREREQUISITE_NOT_COMPLETED");
      }

      const [steps] = await connection.execute(
        `SELECT id, status FROM kyc_steps
          WHERE case_id = ? AND step_number = ?
          LIMIT 1 FOR UPDATE`,
        [caseId, config.stepNumber],
      );
      if (!steps[0]) throw new Error("KYC_STEP_NOT_INITIALIZED");
      if (steps[0].status === "completed") {
        throw new Error("VERIFICATION_ALREADY_COMPLETED");
      }

      const [verifications] = await connection.execute(
        `SELECT id, status, provider_reference FROM kyc_verifications
          WHERE id = ? AND case_id = ? AND verification_type = ?
          LIMIT 1 FOR UPDATE`,
        [verificationId, caseId, verificationType],
      );
      if (!verifications[0]) throw new Error("VERIFICATION_SESSION_NOT_FOUND");
      if (verifications[0].status === "verified") {
        throw new Error("VERIFICATION_ALREADY_COMPLETED");
      }
      if (verifications[0].status !== "pending") {
        throw new Error("VERIFICATION_SESSION_NOT_ACTIVE");
      }
      if (
        typeof authorizationSessionId !== "string" ||
        verifications[0].provider_reference !== getAuthorizationSessionReference(authorizationSessionId)
      ) {
        throw new Error("VERIFICATION_SESSION_NOT_ACTIVE");
      }

      await persistIdentity(connection, { userId, caseId, verificationId, verificationType, verifiedName });

      await connection.execute(
        `UPDATE kyc_verifications
            SET provider = ?,
                provider_reference = NULL,
                status = 'verified',
                masked_identifier = ?,
                verified_name = ?,
                failure_code = NULL,
                verified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [providerName, maskedIdentifier, verifiedName, verificationId],
      );

      await connection.execute(
        `UPDATE kyc_steps
            SET status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                failure_code = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE case_id = ? AND step_number = ?`,
        [caseId, config.stepNumber],
      );

      const [counts] = await connection.execute(
        `SELECT COUNT(*) AS steps_completed FROM kyc_steps
          WHERE case_id = ? AND status = 'completed'`,
        [caseId],
      );
      const stepsCompleted = Number(counts[0]?.steps_completed || 0);
      await connection.execute(
        `UPDATE kyc_cases
            SET steps_completed = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [stepsCompleted, caseId],
      );

      await connection.commit();
      return { verificationType, stepNumber: config.stepNumber, steps_completed: stepsCompleted };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function failVerification({
    userId,
    caseId,
    verificationId,
    authorizationSessionId,
    verificationType,
    failureCode,
  }) {
    const config = VERIFICATION_STEPS[verificationType];
    if (!config) throw new Error("UNSUPPORTED_KYC_VERIFICATION_TYPE");

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      const [users] = await connection.execute(
        `SELECT id FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
        [userId],
      );
      if (!users[0]) throw new Error("KYC_CASE_NOT_FOUND");

      const [cases] = await connection.execute(
        `SELECT id FROM kyc_cases
          WHERE id = ? AND user_id = ?
          LIMIT 1 FOR UPDATE`,
        [caseId, userId],
      );
      if (!cases[0]) throw new Error("KYC_CASE_NOT_FOUND");

      const expectedSessionReference = getAuthorizationSessionReference(authorizationSessionId);
      const [verifications] = await connection.execute(
        `SELECT id, status, provider_reference FROM kyc_verifications
          WHERE id = ? AND case_id = ? AND verification_type = ?
          LIMIT 1 FOR UPDATE`,
        [verificationId, caseId, verificationType],
      );
      if (
        !verifications[0] ||
        verifications[0].status !== "pending" ||
        verifications[0].provider_reference !== expectedSessionReference
      ) {
        await connection.commit();
        return;
      }

      const [steps] = await connection.execute(
        `SELECT id, status FROM kyc_steps
          WHERE case_id = ? AND step_number = ?
          LIMIT 1 FOR UPDATE`,
        [caseId, config.stepNumber],
      );
      if (!steps[0] || steps[0].status === "completed") {
        await connection.commit();
        return;
      }

      await connection.execute(
        `UPDATE kyc_verifications
            SET status = 'failed',
                provider_reference = NULL,
                failure_code = ?,
                verified_at = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND case_id = ?
            AND verification_type = ?
            AND provider_reference = ?
            AND status = 'pending'`,
        [
          failureCode,
          verificationId,
          caseId,
          verificationType,
          expectedSessionReference,
        ],
      );
      await connection.execute(
        `UPDATE kyc_steps
            SET status = 'failed',
                failure_code = ?,
                completed_at = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE case_id = ?
            AND step_number = ?
            AND status <> 'completed'`,
        [failureCode, caseId, config.stepNumber],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function assertNoDevelopmentUnverifiedRecords() {
    if (env.NODE_ENV !== "production") return true;
    const [rows] = await dbPool.execute(
      `SELECT COUNT(*) AS development_unverified_count
         FROM kyc_verifications
        WHERE provider = ?`,
      [DEVELOPMENT_UNVERIFIED_PROVIDER_NAME],
    );
    if (Number(rows[0]?.development_unverified_count || 0) > 0) {
      throw new Error("Production startup blocked because development-only unverified KYC records exist");
    }
    return true;
  }

  return {
    createPendingVerification,
    completeVerification,
    failVerification,
    assertNoDevelopmentUnverifiedRecords,
  };
}

const defaultModel = createDigilockerModel();

export const createPendingVerification = defaultModel.createPendingVerification;
export const completeVerification = defaultModel.completeVerification;
export const failVerification = defaultModel.failVerification;
export const assertNoDevelopmentUnverifiedRecords = defaultModel.assertNoDevelopmentUnverifiedRecords;
export {
  createDigilockerModel,
  DEVELOPMENT_UNVERIFIED_PROVIDER_NAME,
  PROVIDER_NAME,
  VERIFICATION_STEPS,
  getAuthorizationSessionReference,
};
export default {
  createPendingVerification,
  completeVerification,
  failVerification,
  assertNoDevelopmentUnverifiedRecords,
};
