import digilockerService from "../digilocker/digilocker.service.js";
import digilockerModel from "../digilocker/digilocker.model.js";
import aadhaarIdentityModel from "./aadhaar.model.js";

const AADHAAR_HANDLER = Object.freeze({
  documentCode: "ADHAR",
  issuerId: "in.gov.uidai",
  consentPurpose: "To complete AquaPay KYC using Aadhaar verification",
  stepNumber: 2,
});
function isValidDateOfBirth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
function createAadhaarService({
  digilocker = digilockerService,
  model = digilockerModel,
  identityModel = aadhaarIdentityModel,
} = {}) {
  async function initiateVerification(userId, input = {}) {
    return digilocker.initiateAuthorization(userId, "aadhaar", input);
  }

  async function verifyAndPersist({
    attempt,
    userDetails,
    setDiagnosticStage = () => {},
  }) {
    setDiagnosticStage("aadhaar_user_details_validation");

    const user = userDetails?.user;

    if (
      userDetails?.status !== "success" ||
      !user ||
      typeof user !== "object" ||
      typeof user.name !== "string" ||
      !user.name.trim() ||
      user.name.trim().length > 100 ||
      !isValidDateOfBirth(user.dob) ||
      !["M", "F", "T"].includes(user.gender) ||
      user.eaadhaar !== "Y"
    ) {
      throw new Error("INVALID_AADHAAR_USER_DETAILS");
    }

    const extracted = {
      verifiedName: user.name.trim(),
      dateOfBirth: user.dob,
      gender: user.gender,
      eaadhaar: user.eaadhaar,
      verificationMode: "idto_user_details",
    };

    setDiagnosticStage("aadhaar_transactional_persistence");

    const completion = await model.completeVerification({
      ...attempt,
      verificationMode: extracted.verificationMode,
      maskedIdentifier: null,
      verifiedName: extracted.verifiedName,
      persistIdentity: (connection, context) =>
        identityModel.persistVerifiedIdentity(connection, {
          ...context,
          dateOfBirth: extracted.dateOfBirth,
          gender: extracted.gender,
          eaadhaar: extracted.eaadhaar,
        }),
      signatureVerified: false,
    });

    return { extracted, completion };
  }

  const unregister = digilocker.registerVerificationHandler("aadhaar", {
    ...AADHAAR_HANDLER,
    verifyAndPersist,
  });

  return { initiateVerification, verifyAndPersist, unregister };
}

const defaultService = createAadhaarService();

export const initiateVerification = defaultService.initiateVerification;
export const verifyAndPersist = defaultService.verifyAndPersist;
export { AADHAAR_HANDLER, createAadhaarService };
export default { initiateVerification, verifyAndPersist };
