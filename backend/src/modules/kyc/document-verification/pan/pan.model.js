import pool from "../../../../config/db.js";
import identityDataModel from "../shared/identityData.model.js";

const PROVIDER_NAME = "idto_pan_detailed_v2";
const MOCK_PROVIDER_NAME = "idto_pan_detailed_v2_mock";
const ATTEMPT_TTL_MINUTES = 10;

function createPanModel({ dbPool = pool, identityModel = identityDataModel } = {}) {
  async function persistVerifiedIdentity(connection, {
    userId,
    caseId,
    verificationId,
    verificationType,
    panNumber,
  }) {
    if (
      !connection ||
      verificationType !== "pan" ||
      typeof panNumber !== "string" ||
      !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)
    ) {
      const error = new Error("PAN identity data is invalid");
      error.code = "INVALID_IDENTITY_DATA";
      throw error;
    }
    await identityModel.insertIdentityData(connection, {
      userId,
      caseId,
      verificationId,
      identityType: "pan",
      payload: { panNumber },
    });
  }

  async function createPendingVerification(userId, {
    aadhaarVerifiedName,
    providerName = PROVIDER_NAME,
  } = {}) {
    if (![PROVIDER_NAME, MOCK_PROVIDER_NAME].includes(providerName)) {
      throw new Error("PAN_PROVIDER_INVALID");
    }
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.execute(
        `SELECT id, status FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
        [userId],
      );
      if (!users[0] || users[0].status !== "active") throw new Error("USER_NOT_ACTIVE");

      const [cases] = await connection.execute(
        `SELECT id, status FROM kyc_cases
          WHERE user_id = ?
            AND status IN ('draft', 'pending', 'submitted', 'under_review')
          ORDER BY id DESC LIMIT 2 FOR UPDATE`,
        [userId],
      );
      if (cases.length === 0) throw new Error("KYC_CASE_NOT_FOUND");
      if (cases.length > 1) throw new Error("KYC_CASE_AMBIGUOUS");
      const kycCase = cases[0];
      if (kycCase.status !== "pending") throw new Error("KYC_CASE_NOT_EDITABLE");

      const [steps] = await connection.execute(
        `SELECT step_number, status FROM kyc_steps
          WHERE case_id = ? AND step_number IN (2, 3)
          ORDER BY step_number ASC FOR UPDATE`,
        [kycCase.id],
      );
      const aadhaarStep = steps.find((step) => Number(step.step_number) === 2);
      const panStep = steps.find((step) => Number(step.step_number) === 3);
      if (aadhaarStep?.status !== "completed") throw new Error("KYC_PREREQUISITE_NOT_COMPLETED");
      if (!panStep) throw new Error("KYC_STEP_NOT_INITIALIZED");
      if (panStep.status === "completed") throw new Error("VERIFICATION_ALREADY_COMPLETED");

      const [aadhaarRows] = await connection.execute(
        `SELECT id, verified_name FROM kyc_verifications
          WHERE case_id = ? AND verification_type = 'aadhaar' AND status = 'verified'
          ORDER BY id ASC LIMIT 2 FOR UPDATE`,
        [kycCase.id],
      );
      if (aadhaarRows.length !== 1 || typeof aadhaarRows[0].verified_name !== "string" || !aadhaarRows[0].verified_name.trim()) {
        throw new Error(aadhaarRows.length > 1 ? "AADHAAR_VERIFICATION_AMBIGUOUS" : "AADHAAR_VERIFIED_NAME_UNAVAILABLE");
      }
      if (aadhaarRows[0].verified_name !== aadhaarVerifiedName) throw new Error("AADHAAR_VERIFIED_NAME_CHANGED");

      const [verifications] = await connection.execute(
        `SELECT id, status,
                (updated_at > CURRENT_TIMESTAMP - INTERVAL ${ATTEMPT_TTL_MINUTES} MINUTE) AS active_attempt
          FROM kyc_verifications
          WHERE case_id = ? AND verification_type = 'pan'
          ORDER BY id DESC FOR UPDATE`,
        [kycCase.id],
      );
      if (verifications.some((verification) => verification.status === "verified")) {
        throw new Error("VERIFICATION_ALREADY_COMPLETED");
      }
      if (verifications.some((verification) => verification.status === "pending" && Number(verification.active_attempt) === 1)) {
        throw new Error("VERIFICATION_IN_PROGRESS");
      }

      let verificationId;
      const existing = verifications[0];
      if (existing) {
        verificationId = existing.id;
        await connection.execute(
          `UPDATE kyc_verifications
              SET provider = ?, provider_reference = NULL, status = 'pending',
                  masked_identifier = NULL, verified_name = NULL, failure_code = NULL,
                  verified_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND case_id = ? AND verification_type = ?`,
          [providerName, verificationId, kycCase.id, "pan"],
        );
      } else {
        const [inserted] = await connection.execute(
          `INSERT INTO kyc_verifications (case_id, verification_type, provider, status)
           VALUES (?, 'pan', ?, 'pending')`,
          [kycCase.id, providerName],
        );
        verificationId = inserted.insertId;
      }
      await connection.execute(
        `UPDATE kyc_steps SET status = 'in_progress', completed_at = NULL,
             failure_code = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE case_id = ? AND step_number = 3 AND status <> 'completed'`,
        [kycCase.id],
      );
      await connection.commit();
      return {
        userId: String(userId),
        caseId: String(kycCase.id),
        verificationId: String(verificationId),
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
    panNumber,
    maskedIdentifier,
    verifiedName,
    aadhaarVerifiedName,
    providerName = PROVIDER_NAME,
  }) {
    if (![PROVIDER_NAME, MOCK_PROVIDER_NAME].includes(providerName)) throw new Error("PAN_PROVIDER_INVALID");
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.execute(
        `SELECT id, status FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
        [userId],
      );
      if (!users[0] || users[0].status !== "active") throw new Error("USER_NOT_ACTIVE");

      const [cases] = await connection.execute(
        `SELECT id, status FROM kyc_cases WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
        [caseId, userId],
      );
      if (!cases[0]) throw new Error("KYC_CASE_NOT_FOUND");
      if (cases[0].status !== "pending") throw new Error("KYC_CASE_NOT_EDITABLE");

      const [steps] = await connection.execute(
        `SELECT step_number, status FROM kyc_steps
          WHERE case_id = ? AND step_number IN (2, 3)
          ORDER BY step_number ASC FOR UPDATE`,
        [caseId],
      );
      const aadhaarStep = steps.find((step) => Number(step.step_number) === 2);
      const panStep = steps.find((step) => Number(step.step_number) === 3);
      if (aadhaarStep?.status !== "completed") throw new Error("KYC_PREREQUISITE_NOT_COMPLETED");
      if (!panStep) throw new Error("KYC_STEP_NOT_INITIALIZED");
      if (panStep.status === "completed") throw new Error("VERIFICATION_ALREADY_COMPLETED");

      const [aadhaarRows] = await connection.execute(
        `SELECT id, verified_name FROM kyc_verifications
          WHERE case_id = ? AND verification_type = 'aadhaar' AND status = 'verified'
          ORDER BY id ASC LIMIT 2 FOR UPDATE`,
        [caseId],
      );
      if (aadhaarRows.length !== 1 || typeof aadhaarRows[0].verified_name !== "string" || !aadhaarRows[0].verified_name.trim()) {
        throw new Error(aadhaarRows.length > 1 ? "AADHAAR_VERIFICATION_AMBIGUOUS" : "KYC_PREREQUISITE_NOT_COMPLETED");
      }
      if (aadhaarRows[0].verified_name !== aadhaarVerifiedName) throw new Error("AADHAAR_VERIFIED_NAME_CHANGED");

      const [verifications] = await connection.execute(
        `SELECT id, status, provider FROM kyc_verifications
          WHERE id = ? AND case_id = ? AND verification_type = 'pan'
          LIMIT 1 FOR UPDATE`,
        [verificationId, caseId],
      );
      const verification = verifications[0];
      if (!verification) throw new Error("VERIFICATION_SESSION_NOT_FOUND");
      if (verification.status === "verified" || verification.provider === MOCK_PROVIDER_NAME && providerName !== MOCK_PROVIDER_NAME) {
        throw new Error("VERIFICATION_ALREADY_COMPLETED");
      }
      if (verification.status !== "pending" || verification.provider !== providerName) {
        throw new Error("VERIFICATION_SESSION_NOT_ACTIVE");
      }

      await persistVerifiedIdentity(connection, {
        userId,
        caseId,
        verificationId,
        verificationType: "pan",
        panNumber,
      });
      const [verificationUpdate] = await connection.execute(
        `UPDATE kyc_verifications
            SET provider = ?, provider_reference = NULL, status = 'verified',
                masked_identifier = ?, verified_name = ?, failure_code = NULL,
                verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND case_id = ? AND verification_type = 'pan' AND status = 'pending'`,
        [providerName, maskedIdentifier, verifiedName, verificationId, caseId],
      );
      if (Number(verificationUpdate.affectedRows || 0) !== 1) throw new Error("VERIFICATION_SESSION_NOT_ACTIVE");

      const [stepUpdate] = await connection.execute(
        `UPDATE kyc_steps SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
             failure_code = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE case_id = ? AND step_number = 3 AND status <> 'completed'`,
        [caseId],
      );
      if (Number(stepUpdate.affectedRows || 0) !== 1) throw new Error("KYC_STEP_COMPLETION_FAILED");

      const [counts] = await connection.execute(
        `SELECT COUNT(*) AS steps_completed FROM kyc_steps WHERE case_id = ? AND status = 'completed'`,
        [caseId],
      );
      const stepsCompleted = Number(counts[0]?.steps_completed || 0);
      await connection.execute(
        `UPDATE kyc_cases SET steps_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [stepsCompleted, caseId],
      );
      await connection.commit();
      return { stepNumber: 3, steps_completed: stepsCompleted };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function failVerification({ userId, caseId, verificationId, failureCode }) {
    if (!/^[A-Z0-9_]{1,80}$/.test(failureCode || "")) throw new Error("INVALID_FAILURE_CODE");
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [cases] = await connection.execute(
        `SELECT id FROM kyc_cases WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
        [caseId, userId],
      );
      if (!cases[0]) throw new Error("KYC_CASE_NOT_FOUND");
      const [verifications] = await connection.execute(
        `SELECT id, status FROM kyc_verifications
          WHERE id = ? AND case_id = ? AND verification_type = 'pan'
          LIMIT 1 FOR UPDATE`,
        [verificationId, caseId],
      );
      if (!verifications[0] || verifications[0].status !== "pending") {
        await connection.commit();
        return;
      }
      await connection.execute(
        `UPDATE kyc_verifications SET status = 'failed', provider_reference = NULL,
             failure_code = ?, verified_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND case_id = ? AND status = 'pending'`,
        [failureCode, verificationId, caseId],
      );
      await connection.execute(
        `UPDATE kyc_steps SET status = 'failed', failure_code = ?, completed_at = NULL,
             updated_at = CURRENT_TIMESTAMP
          WHERE case_id = ? AND step_number = 3 AND status <> 'completed'`,
        [failureCode, caseId],
      );
      const [counts] = await connection.execute(
        `SELECT COUNT(*) AS steps_completed FROM kyc_steps WHERE case_id = ? AND status = 'completed'`,
        [caseId],
      );
      await connection.execute(
        `UPDATE kyc_cases SET steps_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(counts[0]?.steps_completed || 0), caseId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  return Object.freeze({
    persistVerifiedIdentity,
    createPendingVerification,
    completeVerification,
    failVerification,
  });
}

const defaultModel = createPanModel();

export const persistVerifiedIdentity = defaultModel.persistVerifiedIdentity;
export const createPendingVerification = defaultModel.createPendingVerification;
export const completeVerification = defaultModel.completeVerification;
export const failVerification = defaultModel.failVerification;
export { createPanModel, MOCK_PROVIDER_NAME, PROVIDER_NAME };
export default {
  persistVerifiedIdentity,
  createPendingVerification,
  completeVerification,
  failVerification,
};
