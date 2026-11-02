import fs from "node:fs";
import { X509Certificate } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { getDigiLockerSignaturePolicy } from "./digilocker.signatureConfig.js";

const XMLDSIG_NAMESPACE = "http://www.w3.org/2000/09/xmldsig#";
const MAX_DOCUMENT_XML_BYTES = 512 * 1024;
const DEFAULT_MOCK_CERTIFICATE_PATH = fileURLToPath(
  new URL("./fixtures/mock-signing-cert.crt", import.meta.url),
);
const ALLOWED_SIGNATURE_METHODS = new Set([
  "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
]);
const ALLOWED_CANONICALIZATION_METHODS = new Set([
  "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  "http://www.w3.org/2001/10/xml-exc-c14n#",
]);
const ENVELOPED_SIGNATURE = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const SHA256_DIGEST = "http://www.w3.org/2001/04/xmlenc#sha256";

class DigiLockerDocumentError extends Error {
  constructor(code) {
    super("DigiLocker document could not be validated");
    this.name = "DigiLockerDocumentError";
    this.code = code;
  }
}

function parseXml(xml, invalidDocumentCode = "INVALID_DOCUMENT") {
  if (
    typeof xml !== "string" ||
    Buffer.byteLength(xml, "utf8") > MAX_DOCUMENT_XML_BYTES ||
    /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)
  ) {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }

  const parseErrors = [];
  let document;
  try {
    document = new DOMParser({
      onError(level) {
        if (level === "error" || level === "fatalError") parseErrors.push(level);
      },
    }).parseFromString(xml, "application/xml");
  } catch {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }

  if (parseErrors.length || !document?.documentElement) {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }
  return document;
}

function descendantsByName(node, localName, namespaceUri) {
  const matches = [];
  const visit = (current) => {
    for (let child = current?.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue;
      if (
        child.localName === localName &&
        (namespaceUri === undefined || child.namespaceURI === namespaceUri)
      ) {
        matches.push(child);
      }
      visit(child);
    }
  };
  visit(node);
  return matches;
}

function getAttribute(element, name) {
  return element?.getAttribute(name)?.trim() || "";
}

function safeNamespaceInfo(node) {
  const namespace = node?.namespaceURI || "";
  if (!namespace) return null;
  if (
    namespace.length <= 256 &&
    (/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._~:/-]*)?$/.test(namespace) ||
      /^urn:[A-Za-z0-9:._-]{1,240}$/.test(namespace))
  ) return namespace;
  return "other";
}

function reportValidationDiagnostic(onValidationDiagnostic, metadata) {
  if (typeof onValidationDiagnostic !== "function") return;
  try {
    onValidationDiagnostic(metadata);
  } catch {
    // Diagnostics must never affect document validation.
  }
}

function getTrustedCertificate(environmentKey, env = process.env) {
  const mockMode = env.IDTO_PROVIDER_MODE?.trim() === "mock";
  const isDevelopment = ["development", "test"].includes(env.NODE_ENV);
  if (mockMode && !isDevelopment) {
    throw new DigiLockerDocumentError("SIGNING_CERTIFICATE_NOT_CONFIGURED");
  }

  const certificatePath = mockMode
    ? env.IDTO_MOCK_SIGNING_CERT_PATH?.trim() || DEFAULT_MOCK_CERTIFICATE_PATH
    : env[environmentKey]?.trim();
  if (!certificatePath) {
    throw new DigiLockerDocumentError("SIGNING_CERTIFICATE_NOT_CONFIGURED");
  }

  try {
    const certificate = fs.readFileSync(certificatePath);
    const text = certificate.toString("utf8");
    const certificateBlocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (certificateBlocks && certificateBlocks.length !== 1) {
      throw new Error("Configure one pinned issuer signing certificate per document type");
    }

    // Trust comes from a pinned certificate configured through an independent channel.
    // Never use KeyInfo embedded in the provider response to choose a verification key.
    const x509 = new X509Certificate(certificate);
    const validFrom = Date.parse(x509.validFrom);
    const validTo = Date.parse(x509.validTo);
    if (
      x509.publicKey.asymmetricKeyType !== "rsa" ||
      !Number.isFinite(validFrom) ||
      !Number.isFinite(validTo) ||
      Date.now() < validFrom ||
      Date.now() > validTo
    ) {
      throw new Error("Pinned issuer signing certificate is invalid or outside its validity period");
    }
    return x509.toString();
  } catch {
    throw new DigiLockerDocumentError("SIGNING_CERTIFICATE_NOT_CONFIGURED");
  }
}

function extractCertificateXml(xml, invalidDocumentCode = "INVALID_DOCUMENT", onValidationDiagnostic) {
  let document;
  try {
    document = parseXml(xml, invalidDocumentCode);
  } catch (error) {
    reportValidationDiagnostic(onValidationDiagnostic, {
      validationStage: "provider_xml_parse",
      documentFormat: "invalid_or_malformed_xml",
      xmlRootElementName: null,
      xmlNamespace: null,
      xmlRootPrefixPresent: null,
      expectedDocumentTypeMatched: null,
      expectedIssuerPresent: "not_evaluated",
      requiredFieldPresence: { status: "not_evaluated" },
      validationFailureReason: "xml_parse_failed",
    });
    throw error;
  }
  const root = document.documentElement;
  const documentFormat = root.localName === "Certificate"
    ? "certificate_xml"
    : root.localName === "PullDocResponse"
      ? "pull_doc_response_xml"
      : "unexpected_xml_root";
  reportValidationDiagnostic(onValidationDiagnostic, {
    validationStage: "provider_xml_container",
    documentFormat,
    xmlRootElementName: root.localName,
    xmlNamespace: safeNamespaceInfo(root),
    xmlRootPrefixPresent: Boolean(root.prefix),
    expectedDocumentTypeMatched: null,
    expectedIssuerPresent: "not_evaluated",
    requiredFieldPresence: { status: "not_evaluated" },
    validationFailureReason: root.localName === "Certificate" || root.localName === "PullDocResponse"
      ? null
      : "unexpected_xml_root",
  });
  if (root.localName === "Certificate") return xml;
  if (root.localName !== "PullDocResponse") {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }

  const statuses = descendantsByName(root, "ResponseStatus");
  const details = descendantsByName(root, "DocDetails");
  const dataContents = details.length === 1
    ? descendantsByName(details[0], "DataContent")
    : [];
  const responseStatusSuccess = statuses.length === 1 && getAttribute(statuses[0], "status") === "1";
  const dataContentNonEmpty = dataContents.length === 1 && Boolean(dataContents[0].textContent?.trim());
  const wrapperFailureReason = statuses.length !== 1
    ? "response_status_count_invalid"
    : !responseStatusSuccess
      ? "response_status_not_success"
      : details.length !== 1
        ? "doc_details_count_invalid"
        : dataContents.length !== 1
          ? "data_content_count_invalid"
          : null;
  const wrapperDiagnostic = {
    validationStage: "pull_doc_response_structure",
    documentFormat: "pull_doc_response_xml",
    xmlRootElementName: root.localName,
    xmlNamespace: safeNamespaceInfo(root),
    xmlRootPrefixPresent: Boolean(root.prefix),
    expectedDocumentTypeMatched: null,
    expectedIssuerPresent: "not_evaluated",
    requiredFieldPresence: { status: "not_evaluated" },
    pullDocResponseChecks: {
      responseStatusCount: statuses.length,
      responseStatusSuccess,
      docDetailsCount: details.length,
      dataContentCount: dataContents.length,
      dataContentNonEmpty,
    },
    validationFailureReason: wrapperFailureReason,
  };
  reportValidationDiagnostic(onValidationDiagnostic, wrapperDiagnostic);
  if (wrapperFailureReason) {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }

  const encoded = dataContents[0].textContent?.replace(/\s+/g, "") || "";
  const encodedFailureReason = !encoded
    ? "data_content_empty"
    : encoded.length > MAX_DOCUMENT_XML_BYTES * 2
      ? "data_content_too_large"
      : !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
        ? "data_content_not_base64"
        : null;
  if (encodedFailureReason) {
    reportValidationDiagnostic(onValidationDiagnostic, {
      ...wrapperDiagnostic,
      pullDocResponseChecks: { ...wrapperDiagnostic.pullDocResponseChecks, dataContentNonEmpty: Boolean(encoded) },
      validationFailureReason: encodedFailureReason,
    });
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }

  const decoded = Buffer.from(encoded, "base64");
  const decodedFailureReason = !decoded.length || decoded.length > MAX_DOCUMENT_XML_BYTES
    ? "decoded_content_length_invalid"
    : decoded.toString("base64") !== encoded
      ? "base64_encoding_noncanonical"
      : null;
  if (decodedFailureReason) {
    reportValidationDiagnostic(onValidationDiagnostic, {
      ...wrapperDiagnostic,
      validationFailureReason: decodedFailureReason,
    });
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }
  const certificateXml = decoded.toString("utf8");
  let certificateDocument;
  try {
    certificateDocument = parseXml(certificateXml, invalidDocumentCode);
  } catch (error) {
    reportValidationDiagnostic(onValidationDiagnostic, {
      ...wrapperDiagnostic,
      documentFormat: "pull_doc_response_xml_base64",
      validationFailureReason: "decoded_xml_parse_failed",
    });
    throw error;
  }
  reportValidationDiagnostic(onValidationDiagnostic, {
    validationStage: "decoded_certificate_container",
    documentFormat: "pull_doc_response_xml_base64",
    xmlRootElementName: certificateDocument.documentElement.localName,
    xmlNamespace: safeNamespaceInfo(certificateDocument.documentElement),
    xmlRootPrefixPresent: Boolean(certificateDocument.documentElement.prefix),
    expectedDocumentTypeMatched: null,
    expectedIssuerPresent: "not_evaluated",
    requiredFieldPresence: { status: "not_evaluated" },
    validationFailureReason: certificateDocument.documentElement.localName === "Certificate"
      ? null
      : "decoded_certificate_root_mismatch",
  });
  if (certificateDocument.documentElement.localName !== "Certificate") {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }
  return certificateXml;
}

function verifyDigiLockerXmlSignature(xml, {
  certificateEnvironmentKey,
  expectedDocumentType,
  invalidDocumentCode = "INVALID_DOCUMENT",
  env = process.env,
  onValidationDiagnostic,
} = {}) {
  const signaturePolicy = getDigiLockerSignaturePolicy(env);
  let documentFormat = "unknown_xml";
  const reportDocumentDiagnostic = (metadata) => {
    if (typeof metadata?.documentFormat === "string") documentFormat = metadata.documentFormat;
    reportValidationDiagnostic(onValidationDiagnostic, {
      ...metadata,
      signatureBypassActive: metadata?.signatureBypassActive ?? signaturePolicy.developmentOnly,
    });
  };
  const certificateXml = extractCertificateXml(xml, invalidDocumentCode, reportDocumentDiagnostic);
  const document = parseXml(certificateXml, invalidDocumentCode);
  const root = document.documentElement;
  const typeAttributeByLocalName = Array.from(root.attributes || []).find((attribute) =>
    attribute.localName === "type" || attribute.name?.split(":").at(-1) === "type",
  );
  const documentTypeAttributePresent = root.hasAttribute("type");
  const documentTypeAttributeLocalNamePresent = Boolean(typeAttributeByLocalName);
  const expectedDocumentTypeMatched = getAttribute(root, "type") === expectedDocumentType;
  const validationFailureReason = root.localName !== "Certificate"
    ? "certificate_root_mismatch"
    : !documentTypeAttributePresent
      ? documentTypeAttributeLocalNamePresent
        ? "namespaced_document_type_attribute"
        : "document_type_missing"
      : !expectedDocumentTypeMatched
        ? "document_type_mismatch"
        : null;
  reportValidationDiagnostic(onValidationDiagnostic, {
    validationStage: "document_type_validation",
    documentFormat,
    xmlRootElementName: root.localName,
    xmlNamespace: safeNamespaceInfo(root),
    xmlRootPrefixPresent: Boolean(root.prefix),
    documentTypeAttributePresent,
    documentTypeAttributeLocalNamePresent,
    documentTypeAttributeNamespace: safeNamespaceInfo(typeAttributeByLocalName),
    expectedDocumentTypeMatched,
    expectedIssuerPresent: "not_evaluated",
    requiredFieldPresence: { status: "not_evaluated" },
    validationFailureReason,
    signatureBypassActive: signaturePolicy.developmentOnly,
  });
  if (validationFailureReason) {
    throw new DigiLockerDocumentError(invalidDocumentCode);
  }

  // The explicit development-only bypass still unwraps and parses the provider XML and
  // leaves each document module responsible for type and identity-field validation.
  if (signaturePolicy.developmentOnly) {
    return { xml: certificateXml, ...signaturePolicy };
  }

  const signatures = descendantsByName(root, "Signature", XMLDSIG_NAMESPACE);
  if (signatures.length !== 1) {
    throw new DigiLockerDocumentError("INVALID_DOCUMENT_SIGNATURE");
  }

  const signedInfo = descendantsByName(signatures[0], "SignedInfo", XMLDSIG_NAMESPACE);
  const references = descendantsByName(signatures[0], "Reference", XMLDSIG_NAMESPACE);
  const signatureMethods = descendantsByName(signatures[0], "SignatureMethod", XMLDSIG_NAMESPACE);
  const digestMethods = descendantsByName(signatures[0], "DigestMethod", XMLDSIG_NAMESPACE);
  const canonicalizationMethods = descendantsByName(signatures[0], "CanonicalizationMethod", XMLDSIG_NAMESPACE);
  const transforms = descendantsByName(signatures[0], "Transform", XMLDSIG_NAMESPACE);

  if (
    signedInfo.length !== 1 ||
    references.length !== 1 ||
    references[0].getAttribute("URI") !== "" ||
    signatureMethods.length !== 1 ||
    !ALLOWED_SIGNATURE_METHODS.has(getAttribute(signatureMethods[0], "Algorithm")) ||
    digestMethods.length !== 1 ||
    getAttribute(digestMethods[0], "Algorithm") !== SHA256_DIGEST ||
    canonicalizationMethods.length !== 1 ||
    !ALLOWED_CANONICALIZATION_METHODS.has(getAttribute(canonicalizationMethods[0], "Algorithm")) ||
    transforms.length !== 1 ||
    getAttribute(transforms[0], "Algorithm") !== ENVELOPED_SIGNATURE
  ) {
    throw new DigiLockerDocumentError("INVALID_DOCUMENT_SIGNATURE");
  }

  let signatureVerifier;
  try {
    signatureVerifier = new SignedXml({
      publicCert: getTrustedCertificate(certificateEnvironmentKey, env),
      getCertFromKeyInfo: () => null,
    });
    signatureVerifier.loadSignature(signatures[0]);
    if (!signatureVerifier.checkSignature(certificateXml)) {
      throw new DigiLockerDocumentError("INVALID_DOCUMENT_SIGNATURE");
    }
  } catch (error) {
    if (error instanceof DigiLockerDocumentError) throw error;
    throw new DigiLockerDocumentError("INVALID_DOCUMENT_SIGNATURE");
  }

  const signedReferences = signatureVerifier.getSignedReferences();
  if (!Array.isArray(signedReferences) || signedReferences.length !== 1) {
    throw new DigiLockerDocumentError("INVALID_DOCUMENT_SIGNATURE");
  }
  return { xml: signedReferences[0], ...signaturePolicy };
}

export {
  DigiLockerDocumentError,
  descendantsByName,
  extractCertificateXml,
  getAttribute,
  parseXml,
  verifyDigiLockerXmlSignature,
};
