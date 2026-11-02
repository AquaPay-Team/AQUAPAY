import digilockerService from "../digilocker/digilocker.service.js";
import digilockerModel from "../digilocker/digilocker.model.js";
import aadhaarIdentityModel from "./aadhaar.model.js";
import { validateAadhaarXml } from "./aadhaar.validator.js";

const AADHAAR_HANDLER = Object.freeze({
  documentCode: "ADHAR",
  issuerId: "in.gov.uidai",
  consentPurpose: "To complete AquaPay KYC using Aadhaar verification",
  stepNumber: 2,
});

function createAadhaarService({
  digilocker = digilockerService,
  model = digilockerModel,
  identityModel = aadhaarIdentityModel,
  validateDocument = validateAadhaarXml,
} = {}) {
  async function initiateVerification(userId, input = {}) {
    return digilocker.initiateAuthorization(userId, "aadhaar", input);
  }

  async function verifyAndPersist({
    attempt,
    xml,
    setDiagnosticStage = () => {},
    setDocumentDiagnostics = () => {},
  }) {
    setDiagnosticStage("aadhaar_xml_validation");
    const extracted = validateDocument(xml, {
      onValidationDiagnostic: setDocumentDiagnostics,
    });
    if (
      typeof extracted?.signatureVerified !== "boolean" ||
      extracted.developmentOnly !== !extracted.signatureVerified ||
      extracted.verificationMode !== (extracted.signatureVerified ? "issuer_certificate" : "development_unverified")
    ) throw new Error("INVALID_SIGNATURE_VERIFICATION_RESULT");
    setDiagnosticStage("aadhaar_transactional_persistence");
    const completion = await model.completeVerification({
      ...attempt,
      maskedIdentifier: extracted.maskedIdentifier,
      verifiedName: extracted.verifiedName,
      persistIdentity: (connection, context) => identityModel.persistVerifiedIdentity(connection, {
        ...context,
        aadhaarNumber: extracted.aadhaarNumber,
        address: extracted.address,
        dateOfBirth: extracted.dateOfBirth,
      }),
      signatureVerified: extracted.signatureVerified,
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
