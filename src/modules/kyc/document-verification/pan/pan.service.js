import digilockerService from "../digilocker/digilocker.service.js";
import digilockerModel from "../digilocker/digilocker.model.js";
import panIdentityModel from "./pan.model.js";
import panDocumentProvider from "./pan.provider.js";
import { validatePanXml } from "./pan.validator.js";

const PAN_HANDLER = Object.freeze({
  documentCode: "PANCR",
  issuerId: "in.gov.pan",
  consentPurpose: "To complete AquaPay KYC using PAN verification",
  stepNumber: 3,
});

function selectPanDocument(response) {
  if (response?.status !== "success" || !Array.isArray(response?.issued_docs?.items)) {
    throw new Error("INVALID_ISSUED_DOCS_RESPONSE");
  }
  const documents = response.issued_docs.items.filter((document) =>
    document && document.type === "file" && document.doctype === "PANCR" &&
    document.issuerid === PAN_HANDLER.issuerId && typeof document.uri === "string" &&
    document.uri.length > 0 && document.uri.length <= 2048 &&
    !/[\u0000-\u001f\u007f]/.test(document.uri) &&
    (!Object.hasOwn(document, "mime") || (Array.isArray(document.mime) && document.mime.includes("application/xml"))),
  );
  if (documents.length !== 1) throw new Error(documents.length ? "AMBIGUOUS_REQUIRED_DOCUMENT" : "REQUIRED_DOCUMENT_NOT_FOUND");
  return documents[0];
}

async function retrievePanDocument({ provider, referenceKey, reportProviderStage, onResponseMeta }) {
  const options = onResponseMeta ? { onResponseMeta } : undefined;
  await reportProviderStage("provider_issued_docs", "issued_docs");
  const response = await provider.getIssuedDocs({ reference_key: referenceKey }, options);
  const document = selectPanDocument(response);
  await reportProviderStage("provider_get_issued_docs_xml", "get_issued_docs_xml");
  return provider.getIssuedDocsXml({ reference_key: referenceKey, uri: document.uri }, options);
}

function createPanService({
  digilocker = digilockerService,
  model = digilockerModel,
  identityModel = panIdentityModel,
  provider = panDocumentProvider,
  validateDocument = validatePanXml,
} = {}) {
  async function initiateVerification(userId, input = {}) {
    return digilocker.initiateAuthorization(userId, "pan", input);
  }

  async function verifyAndPersist({ attempt, xml, setDiagnosticStage = () => {} }) {
    await setDiagnosticStage("pan_xml_validation");
    const extracted = validateDocument(xml);
    if (
      typeof extracted?.signatureVerified !== "boolean" ||
      extracted.developmentOnly !== !extracted.signatureVerified ||
      extracted.verificationMode !== (extracted.signatureVerified ? "issuer_certificate" : "development_unverified")
    ) throw new Error("INVALID_SIGNATURE_VERIFICATION_RESULT");
    await setDiagnosticStage("pan_transactional_persistence");
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
    retrieveDocument: (options) => retrievePanDocument({ ...options, provider }),
    verifyAndPersist,
  });

  return { initiateVerification, verifyAndPersist, unregister };
}

const defaultService = createPanService();

export const initiateVerification = defaultService.initiateVerification;
export const verifyAndPersist = defaultService.verifyAndPersist;
export { PAN_HANDLER, createPanService, retrievePanDocument, selectPanDocument };
export default { initiateVerification, verifyAndPersist };
