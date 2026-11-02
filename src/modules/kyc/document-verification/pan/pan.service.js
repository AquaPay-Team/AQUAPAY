import digilockerService from "../digilocker/digilocker.service.js";
import digilockerModel from "../digilocker/digilocker.model.js";
import panIdentityModel from "./pan.model.js";
import { validatePanXml } from "./pan.validator.js";

const PAN_HANDLER = Object.freeze({
  documentCode: "PANCR",
  issuerId: "in.gov.pan",
  consentPurpose: "To complete AquaPay KYC using PAN verification",
  stepNumber: 3,
});

function createPanService({
  digilocker = digilockerService,
  model = digilockerModel,
  identityModel = panIdentityModel,
  validateDocument = validatePanXml,
} = {}) {
  async function initiateVerification(userId, input = {}) {
    return digilocker.initiateAuthorization(userId, "pan", input);
  }

  async function verifyAndPersist({ attempt, xml, setDiagnosticStage = () => {} }) {
    setDiagnosticStage("pan_xml_validation");
    const extracted = validateDocument(xml);
    if (
      typeof extracted?.signatureVerified !== "boolean" ||
      extracted.developmentOnly !== !extracted.signatureVerified ||
      extracted.verificationMode !== (extracted.signatureVerified ? "issuer_certificate" : "development_unverified")
    ) throw new Error("INVALID_SIGNATURE_VERIFICATION_RESULT");
    setDiagnosticStage("pan_transactional_persistence");
    const completion = await model.completeVerification({
      ...attempt,
      maskedIdentifier: extracted.maskedIdentifier,
      verifiedName: extracted.verifiedName,
      persistIdentity: (connection, context) => identityModel.persistVerifiedIdentity(connection, {
        ...context,
        panNumber: extracted.panNumber,
      }),
      signatureVerified: extracted.signatureVerified,
    });
    return { extracted, completion };
  }

  const unregister = digilocker.registerVerificationHandler("pan", {
    ...PAN_HANDLER,
    verifyAndPersist,
  });

  return { initiateVerification, verifyAndPersist, unregister };
}

const defaultService = createPanService();

export const initiateVerification = defaultService.initiateVerification;
export const verifyAndPersist = defaultService.verifyAndPersist;
export { PAN_HANDLER, createPanService };
export default { initiateVerification, verifyAndPersist };
