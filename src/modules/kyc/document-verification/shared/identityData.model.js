import { encryptIdentityPayload } from "./identityData.crypto.js";

function createIdentityDataModel({ encrypt = encryptIdentityPayload } = {}) {
  async function insertIdentityData(connection, {
    userId,
    caseId,
    verificationId,
    identityType,
    payload,
  }) {
    if (!connection || !["aadhaar", "pan"].includes(identityType)) {
      const error = new Error("Identity data is invalid");
      error.code = "INVALID_IDENTITY_DATA";
      throw error;
    }
    const context = { userId, caseId, verificationId };
    const encrypted = encrypt(identityType, payload, context);
    await connection.execute(
      `INSERT INTO kyc_identity_data
        (user_id, case_id, verification_id, identity_type,
         payload_ciphertext, payload_iv, payload_authentication_tag, encryption_key_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        caseId,
        verificationId,
        identityType,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authenticationTag,
        encrypted.keyVersion,
      ],
    );
  }

  return Object.freeze({ insertIdentityData });
}

const defaultModel = createIdentityDataModel();

export const insertIdentityData = defaultModel.insertIdentityData;
export { createIdentityDataModel };
export default { insertIdentityData };
