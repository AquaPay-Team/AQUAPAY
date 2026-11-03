import identityDataModel from "../identity-data/identityData.model.js";

function createAadhaarModel({ identityModel = identityDataModel } = {}) {
  async function persistVerifiedIdentity(connection, {
    userId,
    caseId,
    verificationId,
    verificationType,
    verifiedName,
    dateOfBirth,
    gender,
    eaadhaar,
  }) {
    if (
      !connection ||
      verificationType !== "aadhaar" ||
      typeof verifiedName !== "string" ||
      verifiedName.trim().length < 1 ||
      verifiedName.trim().length > 100 ||
      typeof dateOfBirth !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      !["M", "F", "T"].includes(gender) ||
      eaadhaar !== "Y"
    ) {
      const error = new Error("Aadhaar identity data is invalid");
      error.code = "INVALID_IDENTITY_DATA";
      throw error;
    }

    await identityModel.insertIdentityData(connection, {
      userId,
      caseId,
      verificationId,
      identityType: "aadhaar",
      payload: {
        dateOfBirth,
        gender,
        eaadhaar,
        verificationMode: "idto_user_details",
      },
    });

    await connection.execute(
      `UPDATE users
          SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [verifiedName.trim(), userId],
    );
  }

  return Object.freeze({ persistVerifiedIdentity });
}

const defaultModel = createAadhaarModel();

export const persistVerifiedIdentity = defaultModel.persistVerifiedIdentity;
export { createAadhaarModel };
export default { persistVerifiedIdentity };