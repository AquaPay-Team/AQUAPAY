import crypto from "node:crypto";
import pool from "../../../../config/db.js";
import { getDigiLockerSignaturePolicy } from "./digilocker.signatureConfig.js";

const PROVIDER_NAME = "idto_digilocker_v1";
const DEVELOPMENT_UNVERIFIED_PROVIDER_NAME = "idto_digilocker_v1_dev_unverified";
const DEVELOPMENT_ONLY_PROVIDER_NAMES = Object.freeze([
  DEVELOPMENT_UNVERIFIED_PROVIDER_NAME,
  "idto_pan_detailed_v2_mock",
]);
const ATTEMPT_TTL_MINUTES = 10;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getAuthorizationSessionReferenceFromHash(authorizationSessionHash) {
  if (typeof authorizationSessionHash !== "string" || !/^[a-f0-9]{64}$/.test(authorizationSessionHash)) return "";
  return `aquapay-digilocker:${authorizationSessionHash}`;
}

function validatePreparedAuthorization(prepared) {
  if (
    !prepared || typeof prepared !== "object" ||
    typeof prepared.state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(prepared.state) ||
    typeof prepared.stateHash !== "string" || !/^[a-f0-9]{64}$/.test(prepared.stateHash) ||
    crypto.createHash("sha256").update(prepared.state).digest("hex") !== prepared.stateHash ||
    typeof prepared.sessionId !== "string" || !SESSION_ID_PATTERN.test(prepared.sessionId) ||
    !Number.isInteger(prepared.expiresIn) || prepared.expiresIn < 1 || prepared.expiresIn > 3600 ||
    !Number.isFinite(new Date(prepared.expiresAt).getTime())
  ) throw new Error("INVALID_AUTHORIZATION_STATE");
}

function createDigilockerModel({ dbPool = pool, env = process.env } = {}) {
  async function createPendingVerification(userId, verificationType, preparedAuthorization) {
    const config = VERIFICATION_STEPS[verificationType];
    if (!config) throw new Error("UNSUPPORTED_KYC_VERIFICATION_TYPE");
    validatePreparedAuthorization(preparedAuthorization);

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
            AND status IN ('draft', 'pending', 'submitted', 'under_review')
          ORDER BY id DESC
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

      await connection.execute(
        `UPDATE kyc_digilocker_sessions
            SET status = 'expired', current_stage = 'expired', failure_code = 'AUTHORIZATION_SESSION_EXPIRED',
                reference_key_ciphertext = NULL, reference_key_iv = NULL,
                reference_key_authentication_tag = NULL, reference_key_version = NULL
          WHERE verification_id = ? AND status = 'pending' AND state_expires_at <= CURRENT_TIMESTAMP(3)`,
        [verificationId],
      );
      await connection.execute(
        `UPDATE kyc_digilocker_sessions
            SET status = 'expired', current_stage = 'expired', failure_code = 'CALLBACK_PROCESSING_EXPIRED',
                reference_key_ciphertext = NULL, reference_key_iv = NULL,
                reference_key_authentication_tag = NULL, reference_key_version = NULL
          WHERE verification_id = ? AND status = 'processing'
            AND consumed_at <= CURRENT_TIMESTAMP(3) - INTERVAL ${ATTEMPT_TTL_MINUTES} MINUTE`,
        [verificationId],
      );
      await connection.execute(
        `INSERT INTO kyc_digilocker_sessions
          (session_uuid, user_id, case_id, verification_id, verification_type, provider,
           authorization_session_hash, authorization_state_hash, state_expires_at,
           status, current_stage)
         VALUES (?, ?, ?, ?, ?, 'idto_digilocker_v1', ?, ?, ?, 'pending', 'authorization_pending')`,
        [
          preparedAuthorization.sessionId,
          userId,
          kycCase.id,
          verificationId,
          verificationType,
          crypto.createHash("sha256").update(authorizationSessionId).digest("hex"),
          preparedAuthorization.stateHash,
          preparedAuthorization.expiresAt,
        ],
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
    digilockerSessionId,
    authorizationSessionId,
    authorizationSessionHash,
    verificationType,
    maskedIdentifier,
    verifiedName,
    persistIdentity,
    signatureVerified,
  }) {
    const config = VERIFICATION_STEPS[verificationType];
    if (!config) throw new Error("UNSUPPORTED_KYC_VERIFICATION_TYPE");
    if (verificationType === "pan" && typeof signatureVerified !== "boolean") throw new Error("INVALID_SIGNATURE_VERIFICATION_RESULT");
    if (typeof persistIdentity !== "function") throw new Error("INVALID_IDENTITY_DATA");
    let providerName = PROVIDER_NAME;
    if (verificationType === "pan" && !signatureVerified) {
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
      const expectedSessionReference = authorizationSessionHash
        ? getAuthorizationSessionReferenceFromHash(authorizationSessionHash)
        : getAuthorizationSessionReference(authorizationSessionId);
      if (!expectedSessionReference || verifications[0].provider_reference !== expectedSessionReference ||
          typeof digilockerSessionId !== "string") {
        throw new Error("VERIFICATION_SESSION_NOT_ACTIVE");
      }

      const [digilockerSessions] = await connection.execute(
        `SELECT status, authorization_session_hash, authorization_code_hash, code_verifier_hash
           FROM kyc_digilocker_sessions
          WHERE session_uuid = ? AND user_id = ? AND case_id = ? AND verification_id = ?
          LIMIT 1 FOR UPDATE`,
        [digilockerSessionId, userId, caseId, verificationId],
      );
      if (!digilockerSessions[0] || digilockerSessions[0].status !== "processing" ||
          digilockerSessions[0].authorization_session_hash !== expectedSessionReference.slice("aquapay-digilocker:".length) ||
          !/^[a-f0-9]{64}$/.test(digilockerSessions[0].authorization_code_hash || "") ||
          !/^[a-f0-9]{64}$/.test(digilockerSessions[0].code_verifier_hash || "")) {
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

      await connection.execute(
        `UPDATE kyc_digilocker_sessions
            SET status = 'verified', current_stage = 'complete', failure_code = NULL,
                reference_key_ciphertext = NULL, reference_key_iv = NULL,
                reference_key_authentication_tag = NULL, reference_key_version = NULL,
                verified_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
          WHERE session_uuid = ? AND user_id = ? AND case_id = ? AND verification_id = ?
            AND status = 'processing'`,
        [digilockerSessionId, userId, caseId, verificationId],
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
    digilockerSessionId,
    authorizationSessionId,
    authorizationSessionHash,
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

      const expectedSessionReference = authorizationSessionHash
        ? getAuthorizationSessionReferenceFromHash(authorizationSessionHash)
        : getAuthorizationSessionReference(authorizationSessionId);
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
      if (typeof digilockerSessionId === "string") {
        await connection.execute(
          `UPDATE kyc_digilocker_sessions
              SET status = 'failed', current_stage = 'failed', failure_code = ?,
                  reference_key_ciphertext = NULL, reference_key_iv = NULL,
                  reference_key_authentication_tag = NULL, reference_key_version = NULL,
                  updated_at = CURRENT_TIMESTAMP(3)
            WHERE session_uuid = ? AND user_id = ? AND case_id = ? AND verification_id = ?
              AND status IN ('pending', 'processing')`,
          [failureCode, digilockerSessionId, userId, caseId, verificationId],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }
async function getVerifiedAadhaarName(userId) {
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  // Find the user's KYC case. Reject missing or ambiguous cases.
  const [cases] = await dbPool.execute(
    `SELECT id
       FROM kyc_cases
      WHERE user_id = ?
        AND status IN ('draft', 'pending', 'submitted', 'under_review')
      ORDER BY id DESC
      LIMIT 2`,
    [userId],
  );

  if (cases.length === 0) {
    throw new Error("KYC_CASE_NOT_FOUND");
  }

  if (cases.length > 1) {
    throw new Error("KYC_CASE_AMBIGUOUS");
  }

  const caseId = cases[0].id;

  // Retrieve the verified Aadhaar name only when Step 2 is completed.
  const [verifications] = await dbPool.execute(
    `SELECT v.id, v.verified_name
       FROM kyc_verifications v
       INNER JOIN kyc_steps s
         ON s.case_id = v.case_id
        AND s.step_number = 2
      WHERE v.case_id = ?
        AND v.verification_type = 'aadhaar'
        AND v.status = 'verified'
        AND s.status = 'completed'
      ORDER BY v.id ASC
      LIMIT 2`,
    [caseId],
  );

  if (verifications.length === 0) {
    throw new Error("AADHAAR_VERIFICATION_NOT_COMPLETED");
  }

  if (verifications.length > 1) {
    throw new Error("AADHAAR_VERIFICATION_AMBIGUOUS");
  }

  const verifiedName = verifications[0].verified_name;

  if (
    typeof verifiedName !== "string" ||
    !verifiedName.trim() ||
    verifiedName.length > 100
  ) {
    throw new Error("AADHAAR_VERIFIED_NAME_UNAVAILABLE");
  }

  return verifiedName;
}
  async function assertNoDevelopmentUnverifiedRecords() {
    if (env.NODE_ENV !== "production") return true;
    const [rows] = await dbPool.execute(
      `SELECT COUNT(*) AS development_unverified_count
         FROM kyc_verifications
        WHERE provider IN (?, ?)`,
      DEVELOPMENT_ONLY_PROVIDER_NAMES,
    );
    if (Number(rows[0]?.development_unverified_count || 0) > 0) {
      throw new Error("Production startup blocked because development-only unverified KYC records exist");
    }
    return true;
  }

  async function assertSessionSchema() {
    await dbPool.execute("SELECT 1 FROM kyc_digilocker_sessions LIMIT 0");
    return true;
  }

  return {
    createPendingVerification,
    completeVerification,
    failVerification,
    assertSessionSchema,
    assertNoDevelopmentUnverifiedRecords,
    getVerifiedAadhaarName,
  };
}

const defaultModel = createDigilockerModel();

export const createPendingVerification = defaultModel.createPendingVerification;
export const completeVerification = defaultModel.completeVerification;
export const failVerification = defaultModel.failVerification;
export const assertSessionSchema = defaultModel.assertSessionSchema;
export const getVerifiedAadhaarName = defaultModel.getVerifiedAadhaarName;
export const assertNoDevelopmentUnverifiedRecords = defaultModel.assertNoDevelopmentUnverifiedRecords;
export {
  createDigilockerModel,
  DEVELOPMENT_UNVERIFIED_PROVIDER_NAME,
  DEVELOPMENT_ONLY_PROVIDER_NAMES,
  PROVIDER_NAME,
  VERIFICATION_STEPS,
  getAuthorizationSessionReference,
};
export default {
  createPendingVerification,
  completeVerification,
  failVerification,
  assertSessionSchema,
  getVerifiedAadhaarName,
  assertNoDevelopmentUnverifiedRecords,
};
