import crypto from "node:crypto";
import pool from "../../../../config/db.js";
import { encryptReferenceKey, decryptReferenceKey } from "../shared/providerSession.crypto.js";

const STATE_TTL_SECONDS = 600;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STAGES = new Set([
  "authorization_pending",
  "get_reference",
  "user_details",
  "fetch_aadhaar",
  "issued_docs",
  "get_issued_docs_xml",
  "aadhaar_validation",
  "pan_validation",
  "persistence",
  "complete",
  "failed",
  "expired",
]);

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeProviderSummary(response) {
  const summary = {};
  for (const key of ["status", "code", "chargeble", "user_consent"]) {
    const value = response?.[key];
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      summary[key] = value;
    } else if (typeof value === "string" && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value)) {
      summary[key] = value;
    }
  }
  return Object.keys(summary).length ? JSON.stringify(summary) : null;
}

function dateValue(value) {
  if (value === undefined || value === null) return null;
  const parsed = new Date(value);
  // Pass a Date through mysql2's configured timezone conversion instead of
  // writing a UTC-looking timezone-free DATETIME string that MySQL may later
  // read back as local time. This keeps expiry comparisons round-trip safe.
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function mapPublicStatus(row) {
  if (!row) return null;
  const status = row.status === "verified"
    ? "VERIFIED"
    : ["failed", "expired"].includes(row.status)
      ? "FAILED"
      : "PENDING";
  return {
    sessionId: row.session_uuid,
    status,
    stage: row.current_stage,
    message: status === "VERIFIED"
      ? "Aadhaar verification completed"
      : status === "FAILED"
        ? "Aadhaar verification failed"
        : "Aadhaar verification is in progress",
    failureCode: status === "FAILED" ? row.failure_code : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createDigilockerStateStore({
  dbPool = pool,
  now = Date.now,
  ttlSeconds = STATE_TTL_SECONDS,
  randomBytes = crypto.randomBytes,
  randomUUID = crypto.randomUUID,
  encrypt = encryptReferenceKey,
  decrypt = decryptReferenceKey,
} = {}) {
  async function failExpiredKycStep(connection, row, failureCode) {
    const stepNumber = row.verification_type === "pan" ? 3 : 2;
    const providerReference = `aquapay-digilocker:${row.authorization_session_hash}`;
    await connection.execute(
      `UPDATE kyc_verifications
          SET status = 'failed', provider_reference = NULL, failure_code = ?,
              verified_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND case_id = ? AND verification_type = ?
          AND status = 'pending' AND provider_reference = ?`,
      [failureCode, row.verification_id, row.case_id, row.verification_type, providerReference],
    );
    await connection.execute(
      `UPDATE kyc_steps
          SET status = 'failed', failure_code = ?, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE case_id = ? AND step_number = ? AND status <> 'completed'`,
      [failureCode, row.case_id, stepNumber],
    );
  }

  function prepareAuthorizationState() {
    const state = randomBytes(32).toString("base64url");
    const sessionId = randomUUID();
    if (!SESSION_ID_PATTERN.test(sessionId)) throw new Error("Unable to create DigiLocker session");
    const expiresAt = new Date(now() + ttlSeconds * 1000);
    return { state, stateHash: hash(state), sessionId, expiresIn: ttlSeconds, expiresAt };
  }

  async function consumeAuthorizationState(state, { code, codeVerifier } = {}) {
    if (
      typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      typeof code !== "string" || code.length < 1 || code.length > 512 || /[\u0000-\u001f\u007f]/.test(code) ||
      typeof codeVerifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
    ) return null;
    const authorizationCodeHash = hash(code);
    const codeVerifierHash = hash(codeVerifier);
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id, session_uuid, user_id, case_id, verification_id, verification_type,
                authorization_session_hash, state_expires_at, status
           FROM kyc_digilocker_sessions
          WHERE authorization_state_hash = ?
          LIMIT 1 FOR UPDATE`,
        [hash(state)],
      );
      const row = rows[0];
      if (!row || row.status !== "pending") {
        await connection.commit();
        return null;
      }
      if (new Date(row.state_expires_at).getTime() <= now()) {
        await failExpiredKycStep(connection, row, "AUTHORIZATION_SESSION_EXPIRED");
        await connection.execute(
          `UPDATE kyc_digilocker_sessions
              SET status = 'expired', current_stage = 'expired', failure_code = 'AUTHORIZATION_SESSION_EXPIRED',
                  reference_key_ciphertext = NULL, reference_key_iv = NULL,
                  reference_key_authentication_tag = NULL, reference_key_version = NULL
            WHERE id = ? AND status = 'pending'`,
          [row.id],
        );
        await connection.commit();
        return null;
      }
      const [updated] = await connection.execute(
        `UPDATE kyc_digilocker_sessions
            SET status = 'processing', current_stage = 'get_reference', consumed_at = CURRENT_TIMESTAMP(3),
                authorization_code_hash = ?, code_verifier_hash = ?
          WHERE id = ? AND status = 'pending' AND state_expires_at > CURRENT_TIMESTAMP(3)`,
        [authorizationCodeHash, codeVerifierHash, row.id],
      );
      if (updated.affectedRows !== 1) {
        await connection.commit();
        return null;
      }
      await connection.commit();
      return {
        digilockerSessionId: row.session_uuid,
        userId: String(row.user_id),
        caseId: String(row.case_id),
        verificationId: String(row.verification_id),
        authorizationSessionHash: row.authorization_session_hash,
        verificationType: row.verification_type,
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async function discardAuthorizationState(state, failureCode = "IDTO_INITIATION_FAILED") {
    if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) return false;
    const [result] = await dbPool.execute(
      `UPDATE kyc_digilocker_sessions
          SET status = 'failed', current_stage = 'failed', failure_code = ?
        WHERE authorization_state_hash = ? AND status = 'pending'`,
      [failureCode, hash(state)],
    );
    return result.affectedRows === 1;
  }

  async function saveInitiationResponse(sessionId, response) {
    if (!SESSION_ID_PATTERN.test(String(sessionId))) throw new Error("Invalid DigiLocker session ID");
    const [result] = await dbPool.execute(
      `UPDATE kyc_digilocker_sessions
          SET provider_init_status = ?, provider_init_code = ?, provider_init_metadata = ?,
              current_stage = 'authorization_pending'
        WHERE session_uuid = ? AND status = 'pending'`,
      [
        typeof response?.status === "string" ? response.status.slice(0, 40) : null,
        response?.code === undefined || response?.code === null ? null : String(response.code).slice(0, 32),
        safeProviderSummary(response),
        sessionId,
      ],
    );
    if (result.affectedRows !== 1) throw new Error("DIGILOCKER_SESSION_NOT_ACTIVE");
  }

  async function setStage(sessionId, stage) {
    if (!SESSION_ID_PATTERN.test(String(sessionId)) || !ALLOWED_STAGES.has(stage)) {
      throw new Error("Invalid DigiLocker workflow stage");
    }
    const [result] = await dbPool.execute(
      `UPDATE kyc_digilocker_sessions SET current_stage = ?
        WHERE session_uuid = ? AND status = 'processing'`,
      [stage, sessionId],
    );
    if (result.affectedRows !== 1) throw new Error("DIGILOCKER_SESSION_NOT_ACTIVE");
  }

  async function saveReferenceKey(session, referenceKey, expiresAt) {
    const encrypted = encrypt(referenceKey, {
      sessionId: session.digilockerSessionId,
      userId: session.userId,
      caseId: session.caseId,
      verificationId: session.verificationId,
    });
    const [result] = await dbPool.execute(
      `UPDATE kyc_digilocker_sessions
          SET reference_key_ciphertext = ?, reference_key_iv = ?,
              reference_key_authentication_tag = ?, reference_key_version = ?,
              reference_expires_at = ?, current_stage = 'user_details'
        WHERE session_uuid = ? AND user_id = ? AND case_id = ? AND verification_id = ?
          AND status = 'processing'`,
      [
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authenticationTag,
        encrypted.keyVersion,
        dateValue(expiresAt),
        session.digilockerSessionId,
        session.userId,
        session.caseId,
        session.verificationId,
      ],
    );
    if (result.affectedRows !== 1) throw new Error("DIGILOCKER_SESSION_NOT_ACTIVE");
  }

  async function loadReferenceKey(session) {
    const [rows] = await dbPool.execute(
      `SELECT reference_key_ciphertext, reference_key_iv,
              reference_key_authentication_tag, reference_key_version, reference_expires_at
         FROM kyc_digilocker_sessions
        WHERE session_uuid = ? AND user_id = ? AND case_id = ? AND verification_id = ?
          AND status = 'processing'
        LIMIT 1`,
      [session.digilockerSessionId, session.userId, session.caseId, session.verificationId],
    );
    const row = rows[0];
    if (!row?.reference_key_ciphertext) throw new Error("DIGILOCKER_REFERENCE_NOT_FOUND");
    if (row.reference_expires_at && new Date(row.reference_expires_at).getTime() <= now()) {
      throw new Error("REFERENCE_KEY_EXPIRED");
    }
    return decrypt({
      ciphertext: row.reference_key_ciphertext,
      iv: row.reference_key_iv,
      authenticationTag: row.reference_key_authentication_tag,
      keyVersion: row.reference_key_version,
    }, {
      sessionId: session.digilockerSessionId,
      userId: session.userId,
      caseId: session.caseId,
      verificationId: session.verificationId,
    });
  }

  async function getSessionStatus(userId, sessionId) {
    if (!/^[1-9]\d*$/.test(String(userId))) throw new Error("Invalid user ID");
    if (sessionId !== undefined && !SESSION_ID_PATTERN.test(String(sessionId))) return null;
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT session_uuid, user_id, case_id, verification_id, verification_type,
                authorization_session_hash, status, current_stage, failure_code, state_expires_at,
                reference_expires_at, consumed_at, created_at, updated_at
           FROM kyc_digilocker_sessions
          WHERE user_id = ? AND verification_type = 'aadhaar'
            AND (? IS NULL OR session_uuid = ?)
          ORDER BY created_at DESC
          LIMIT 1 FOR UPDATE`,
        [userId, sessionId ?? null, sessionId ?? null],
      );
      let row = rows[0];
      if (row?.status === "pending" && new Date(row.state_expires_at).getTime() <= now()) {
        await failExpiredKycStep(connection, row, "AUTHORIZATION_SESSION_EXPIRED");
        await connection.execute(
          `UPDATE kyc_digilocker_sessions
              SET status = 'expired', current_stage = 'expired', failure_code = 'AUTHORIZATION_SESSION_EXPIRED',
                  reference_key_ciphertext = NULL, reference_key_iv = NULL,
                  reference_key_authentication_tag = NULL, reference_key_version = NULL
            WHERE session_uuid = ? AND status = 'pending'`,
          [row.session_uuid],
        );
        row = { ...row, status: "expired", current_stage: "expired", failure_code: "AUTHORIZATION_SESSION_EXPIRED" };
      } else if (row?.status === "processing" && (
        (row.consumed_at && new Date(row.consumed_at).getTime() <= now() - ttlSeconds * 1000) ||
        (row.reference_expires_at && new Date(row.reference_expires_at).getTime() <= now())
      )) {
        const failureCode = row.reference_expires_at && new Date(row.reference_expires_at).getTime() <= now()
          ? "REFERENCE_KEY_EXPIRED"
          : "CALLBACK_PROCESSING_EXPIRED";
        await failExpiredKycStep(connection, row, failureCode);
        await connection.execute(
          `UPDATE kyc_digilocker_sessions
              SET status = 'expired', current_stage = 'expired', failure_code = ?,
                  reference_key_ciphertext = NULL, reference_key_iv = NULL,
                  reference_key_authentication_tag = NULL, reference_key_version = NULL
            WHERE session_uuid = ? AND status = 'processing'`,
          [failureCode, row.session_uuid],
        );
        row = { ...row, status: "expired", current_stage: "expired", failure_code: failureCode };
      }
      await connection.commit();
      return mapPublicStatus(row);
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  return Object.freeze({
    prepareAuthorizationState,
    consumeAuthorizationState,
    discardAuthorizationState,
    saveInitiationResponse,
    setStage,
    saveReferenceKey,
    loadReferenceKey,
    getSessionStatus,
  });
}

const defaultStore = createDigilockerStateStore();

export const prepareAuthorizationState = defaultStore.prepareAuthorizationState;
export const consumeAuthorizationState = defaultStore.consumeAuthorizationState;
export const discardAuthorizationState = defaultStore.discardAuthorizationState;
export const saveInitiationResponse = defaultStore.saveInitiationResponse;
export const setStage = defaultStore.setStage;
export const saveReferenceKey = defaultStore.saveReferenceKey;
export const loadReferenceKey = defaultStore.loadReferenceKey;
export const getSessionStatus = defaultStore.getSessionStatus;
export { createDigilockerStateStore };
export default {
  prepareAuthorizationState,
  consumeAuthorizationState,
  discardAuthorizationState,
  saveInitiationResponse,
  setStage,
  saveReferenceKey,
  loadReferenceKey,
  getSessionStatus,
};
