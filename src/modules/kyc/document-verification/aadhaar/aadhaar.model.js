import identityDataModel from "../identity-data/identityData.model.js";

function createAadhaarModel({ identityModel = identityDataModel } = {}) {
  async function persistVerifiedIdentity(connection, {
    userId,
    caseId,
    verificationId,
    verificationType,
    verifiedName,
    aadhaarNumber,
    address,
    dateOfBirth,
  }) {
    if (
      !connection || verificationType !== "aadhaar" ||
      typeof verifiedName !== "string" || verifiedName.length < 1 || verifiedName.length > 100 ||
      typeof aadhaarNumber !== "string" || !/^\d{12}$/.test(aadhaarNumber) ||
      !Array.isArray(address) || address.length === 0 ||
      typeof dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
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
      payload: { aadhaarNumber, address, dateOfBirth },
    });
    await connection.execute(
      `UPDATE users
          SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [verifiedName, userId],
    );
  }

  return Object.freeze({ persistVerifiedIdentity });
}

const defaultModel = createAadhaarModel();

export const persistVerifiedIdentity = defaultModel.persistVerifiedIdentity;
export { createAadhaarModel };
export default { persistVerifiedIdentity };
