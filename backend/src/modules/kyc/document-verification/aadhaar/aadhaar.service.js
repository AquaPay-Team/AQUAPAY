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

async function retrieveAadhaarDocument({ provider, referenceKey, reportProviderStage, onResponseMeta }) {
  const options = onResponseMeta ? { onResponseMeta } : undefined;
  await reportProviderStage("provider_user_details", "user_details");
  const userDetails = await provider.getUserDetails({ reference_key: referenceKey }, options);
  if (!userDetails || typeof userDetails !== "object" || Array.isArray(userDetails)) {
    throw new Error("IDTO_INVALID_RESPONSE");
  }
  if (userDetails && Object.hasOwn(userDetails, "status") && userDetails.status !== "success") {
    throw new Error("IDTO_OPERATION_FAILED");
  }
  await reportProviderStage("provider_fetch_aadhaar", "fetch_aadhaar");
  return provider.fetchAadhaar({ reference_key: referenceKey }, options);
}

function createAadhaarService({
  digilocker = digilockerService,
  model = digilockerModel,
  identityModel = aadhaarIdentityModel,
  validateDocument = validateAadhaarXml,
} = {}) {
  async function initiateVerification(userId, input = {}) {
    return digilocker.initiateAuthorization(userId, "aadhaar", input);
  }

  async function getVerificationStatus(userId, sessionId) {
    return digilocker.getAadhaarSessionStatus(userId, sessionId);
  }

  async function verifyAndPersist({
    attempt,
    xml,
    setDiagnosticStage = () => {},
    setDocumentDiagnostics = () => {},
  }) {
    await setDiagnosticStage("aadhaar_xml_validation");
    const extracted = validateDocument(xml, {
      onValidationDiagnostic: setDocumentDiagnostics,
    });
    await setDiagnosticStage("aadhaar_transactional_persistence");
    const completion = await model.completeVerification({
      ...attempt,
      maskedIdentifier: extracted.maskedIdentifier,
      verifiedName: extracted.verifiedName,
      persistIdentity: (connection, context) => identityModel.persistVerifiedIdentity(connection, {
        ...context,
        aadhaarNumber: extracted.aadhaarNumber,
        aadhaarMaskedIdentifier: extracted.aadhaarMaskedIdentifier,
        address: extracted.address,
        dateOfBirth: extracted.dateOfBirth,
      }),
    });
    return { extracted, completion };
  }

  const unregister = digilocker.registerVerificationHandler("aadhaar", {
    ...AADHAAR_HANDLER,
    retrieveDocument: retrieveAadhaarDocument,
    verifyAndPersist,
  });

  return { initiateVerification, getVerificationStatus, verifyAndPersist, unregister };
}

const defaultService = createAadhaarService();

export const initiateVerification = defaultService.initiateVerification;
export const getVerificationStatus = defaultService.getVerificationStatus;
export const verifyAndPersist = defaultService.verifyAndPersist;
export { AADHAAR_HANDLER, createAadhaarService, retrieveAadhaarDocument };
export default { initiateVerification, getVerificationStatus, verifyAndPersist };
