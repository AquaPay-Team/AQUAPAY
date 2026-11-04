import identityDataModel from "../shared/identityData.model.js";

function createPanModel({ identityModel = identityDataModel } = {}) {
  async function persistVerifiedIdentity(connection, {
    userId,
    caseId,
    verificationId,
    verificationType,
    panNumber,
  }) {
    if (!connection || verificationType !== "pan" || typeof panNumber !== "string" || !/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber)) {
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

  return Object.freeze({ persistVerifiedIdentity });
}

const defaultModel = createPanModel();

export const persistVerifiedIdentity = defaultModel.persistVerifiedIdentity;
export { createPanModel };
export default { persistVerifiedIdentity };
