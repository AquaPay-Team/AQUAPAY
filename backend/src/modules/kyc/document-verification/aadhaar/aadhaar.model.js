import identityDataModel from "../shared/identityData.model.js";

function createAadhaarModel({ identityModel = identityDataModel } = {}) {
  async function persistVerifiedIdentity(connection, {
    userId,
    caseId,
    verificationId,
    verificationType,
    verifiedName,
    aadhaarNumber,
    aadhaarMaskedIdentifier,
    address,
    dateOfBirth,
  }) {
    const hasFullAadhaar = typeof aadhaarNumber === "string" && /^\d{12}$/.test(aadhaarNumber);
    const hasMaskedAadhaar = typeof aadhaarMaskedIdentifier === "string" && /^[xX*]{4,8}\d{4}$/.test(aadhaarMaskedIdentifier);
    const invalidFullAadhaar = aadhaarNumber !== undefined && aadhaarNumber !== null && !hasFullAadhaar;
    const invalidMaskedAadhaar = aadhaarMaskedIdentifier !== undefined && aadhaarMaskedIdentifier !== null && !hasMaskedAadhaar;
    if (
      !connection || verificationType !== "aadhaar" ||
      typeof verifiedName !== "string" || verifiedName.length < 1 || verifiedName.length > 100 ||
      hasFullAadhaar === hasMaskedAadhaar || invalidFullAadhaar || invalidMaskedAadhaar ||
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
      payload: {
        ...(hasFullAadhaar ? { aadhaarNumber } : { aadhaarMaskedIdentifier: aadhaarMaskedIdentifier.toUpperCase() }),
        address,
        dateOfBirth,
      },
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
