import {
  DigiLockerDocumentError,
  descendantsByName,
  extractCertificateXml,
  getAttribute,
  parseXml,
  verifyDigiLockerXmlSignature,
} from "../digilocker/digilocker.signature.js";
import { getDigiLockerSignaturePolicy } from "../digilocker/digilocker.signatureConfig.js";
import { X509Certificate } from "node:crypto";
import fs from "node:fs";
function logEmbeddedSignerCertificate(root) {
  try {
    const found = [];
    for (const node of descendantsByName(root, "X509Certificate")) {
      const body = (node.textContent || "").replace(/\s+/g, "");
      const pem =
        "-----BEGIN CERTIFICATE-----\n" +
        body.match(/.{1,64}/g).join("\n") +
        "\n-----END CERTIFICATE-----\n";
      const cert = new X509Certificate(pem);
      found.push({
        subject: cert.subject.replace(/\n/g, ", "),
        issuer: cert.issuer.replace(/\n/g, ", "),
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        serialNumber: cert.serialNumber,
        sha256Fingerprint: cert.fingerprint256,
        keyType: cert.publicKey.asymmetricKeyType,
      });
      fs.writeFileSync(`embedded-signer-${found.length}.pem`, pem);
    }
    console.log(
      "[TEMP embedded signer certificate]",
      JSON.stringify(found, null, 2),
    );
  } catch (error) {
    console.log(
      "[TEMP embedded signer certificate] could not read:",
      error.message,
    );
  }
}

// Real IDTO/DigiLocker Aadhaar documents are UIDAI offline eKYC XML:
//   Certificate > CertificateData > KycRes > UidData > (Poi, Poa, LData, Pht)
// followed by a Certificate-level enveloped Signature. The Pht (photo) and
// LData (local-language address) elements are deliberately never read.

// Poa attribute -> field name accepted by identityData.crypto.js.
// "co" (care-of), "po" and "subdist" have no destination field and are dropped.
const POA_FIELD_MAP = Object.freeze({
  lm: "landmark",
  loc: "locality",
  vtc: "vtc",
  dist: "district",
  pc: "pin",
  state: "state",
  country: "country",
});
const REQUIRED_ADDRESS_FIELDS = ["vtc", "state", "country"];

function reportAadhaarDiagnostic(onValidationDiagnostic, metadata) {
  if (typeof onValidationDiagnostic !== "function") return;
  try {
    onValidationDiagnostic(metadata);
  } catch {
    // Diagnostics must never affect document validation.
  }
}

function locateKycElements(root) {
  const within = (parent, name) =>
    parent ? descendantsByName(parent, name) : [];
  const certificateData = within(root, "CertificateData");
  const kycRes =
    certificateData.length === 1 ? within(certificateData[0], "KycRes") : [];
  const uidData = kycRes.length === 1 ? within(kycRes[0], "UidData") : [];
  const poi = uidData.length === 1 ? within(uidData[0], "Poi") : [];
  const poa = uidData.length === 1 ? within(uidData[0], "Poa") : [];
  return { certificateData, kycRes, uidData, poi, poa };
}

// Booleans only: diagnostics must never carry identity values.
function describeFieldPresence(found) {
  const kycRes = found.kycRes[0];
  const uidData = found.uidData[0];
  const poi = found.poi[0];
  const poa = found.poa[0];
  return {
    certificateData: found.certificateData.length === 1,
    kycRes: found.kycRes.length === 1,
    uidData: found.uidData.length === 1,
    poi: found.poi.length === 1,
    poa: found.poa.length === 1,
    kycResultOk: getAttribute(kycRes, "ret") === "Y",
    aadhaarNumber: Boolean(uidData?.hasAttribute("uid")),
    name: Boolean(poi?.hasAttribute("name")),
    dateOfBirth: Boolean(poi?.hasAttribute("dob")),
    addressVtc: Boolean(getAttribute(poa, "vtc")),
    addressState: Boolean(getAttribute(poa, "state")),
    addressCountry: Boolean(getAttribute(poa, "country")),
  };
}

function reportAadhaarStructure(
  xml,
  onValidationDiagnostic,
  signatureBypassActive,
) {
  let providerXmlFormat = null;
  let providerXmlRootElementName = null;
  let providerXmlNamespace = null;
  const certificateXml = extractCertificateXml(
    xml,
    "INVALID_AADHAAR_DOCUMENT",
    (metadata) => {
      if (metadata?.validationStage === "provider_xml_container") {
        providerXmlFormat = metadata.documentFormat;
        providerXmlRootElementName = metadata.xmlRootElementName;
        providerXmlNamespace = metadata.xmlNamespace;
      }
      reportAadhaarDiagnostic(onValidationDiagnostic, {
        ...metadata,
        signatureBypassActive,
      });
    },
  );
  const root = parseXml(
    certificateXml,
    "INVALID_AADHAAR_DOCUMENT",
  ).documentElement;

  reportAadhaarDiagnostic(onValidationDiagnostic, {
    validationStage: "aadhaar_document_structure",
    documentFormat: "certificate_xml",
    providerDocumentFormat: providerXmlFormat,
    providerXmlRootElementName,
    providerXmlNamespace,
    xmlRootElementName: root.localName,
    xmlRootPrefixPresent: Boolean(root.prefix),
    documentTypeAttributePresent: root.hasAttribute("type"),
    expectedDocumentTypeMatched: "not_applicable",
    expectedIssuerPresent: "not_applicable",
    requiredFieldPresence: describeFieldPresence(locateKycElements(root)),
    validationFailureReason: null,
    signatureBypassActive,
  });
  return certificateXml;
}

function parseAadhaarFields(xml, { onValidationDiagnostic } = {}) {
  let document;
  try {
    document = parseXml(xml, "INVALID_AADHAAR_DOCUMENT");
  } catch (error) {
    reportAadhaarDiagnostic(onValidationDiagnostic, {
      validationStage: "aadhaar_xml_parse",
      documentFormat: "xml",
      xmlRootElementName: null,
      xmlNamespace: null,
      xmlRootPrefixPresent: null,
      documentTypeAttributePresent: null,
      expectedDocumentTypeMatched: "not_applicable",
      expectedIssuerPresent: "not_applicable",
      requiredFieldPresence: { status: "not_evaluated" },
      validationFailureReason: "xml_parse_failed",
    });
    throw error;
  }

  const root = document.documentElement;
  const found = locateKycElements(root);
  const baseDiagnostic = {
    validationStage: "aadhaar_identity_fields",
    documentFormat: "certificate_xml",
    xmlRootElementName: root.localName,
    xmlRootPrefixPresent: Boolean(root.prefix),
    documentTypeAttributePresent: root.hasAttribute("type"),
    expectedDocumentTypeMatched: "not_applicable",
    expectedIssuerPresent: "not_applicable",
    requiredFieldPresence: describeFieldPresence(found),
  };
  const fail = (reason) => {
    reportAadhaarDiagnostic(onValidationDiagnostic, {
      ...baseDiagnostic,
      validationFailureReason: reason,
    });
    throw new DigiLockerDocumentError("INVALID_AADHAAR_DOCUMENT");
  };

  if (root.localName !== "Certificate") fail("certificate_root_mismatch");
  if (found.certificateData.length !== 1)
    fail("certificate_data_element_count_invalid");
  if (found.kycRes.length !== 1) fail("kyc_response_element_count_invalid");
  if (found.uidData.length !== 1) fail("uid_data_element_count_invalid");
  if (found.poi.length !== 1) fail("poi_element_count_invalid");
  if (found.poa.length !== 1) fail("poa_element_count_invalid");

  const [kycRes] = found.kycRes;
  const [uidData] = found.uidData;
  const [poi] = found.poi;
  const [poa] = found.poa;

  if (getAttribute(kycRes, "ret") !== "Y") fail("kyc_result_not_successful");

const rawUid = getAttribute(uidData, "uid").replace(/\s/g, "");

const fullUid = rawUid.replace(/-/g, "");
const isFullUid = /^\d{12}$/.test(fullUid);

// Accept a masked UID only when it clearly represents 8 masked
// characters followed by the final 4 digits.
const isMaskedUid =
  /^(?:[xX*]{4}[-\s]?[xX*]{4}[-\s]?\d{4}|[xX*]{8}\d{4})$/.test(rawUid);

if (!isFullUid && !isMaskedUid) {
  fail("aadhaar_number_format_invalid");
}

const uid = isFullUid ? fullUid : null;
const maskedIdentifier = isFullUid
  ? `XXXXXX${fullUid.slice(-4)}`
  : `XXXXXX${rawUid.replace(/\D/g, "").slice(-4)}`;
  const verifiedName = getAttribute(poi, "name").replace(/\s+/g, " ").trim();
  if (
    !verifiedName ||
    verifiedName.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(verifiedName)
  ) {
    fail("name_invalid_or_missing");
  }

  const birthDate = getAttribute(poi, "dob");
  const dobMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(birthDate);
  if (!dobMatch) fail("date_of_birth_format_invalid");
  const [, dayText, monthText, yearText] = dobMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const dobDate = new Date(Date.UTC(year, month - 1, day));
  if (
    dobDate.getUTCFullYear() !== year ||
    dobDate.getUTCMonth() !== month - 1 ||
    dobDate.getUTCDate() !== day ||
    year < 1900 ||
    dobDate.getTime() > Date.now()
  ) {
    fail("date_of_birth_invalid");
  }

  const entry = {};
  for (const [attributeName, fieldName] of Object.entries(POA_FIELD_MAP)) {
    if (!poa.hasAttribute(attributeName)) continue;
    const value = getAttribute(poa, attributeName);
    if (/[\u0000-\u001f\u007f]/.test(value) || value.length > 500) {
      fail("address_field_value_invalid");
    }
    if (value) entry[fieldName] = value;
  }
  if (!REQUIRED_ADDRESS_FIELDS.every((field) => entry[field])) {
    fail("required_address_field_missing");
  }
  if (entry.pin !== undefined && !/^\d{6}$/.test(entry.pin)) {
    fail("address_pin_invalid");
  }

  reportAadhaarDiagnostic(onValidationDiagnostic, {
    ...baseDiagnostic,
    validationFailureReason: null,
  });

  return {
    aadhaarNumber: uid,
    maskedIdentifier,
    verifiedName,
    address: [entry],
    dateOfBirth: `${yearText}-${monthText}-${dayText}`,
  };
}

function validateAadhaarXml(
  xml,
  { env = process.env, onValidationDiagnostic } = {},
) {
  const signaturePolicy = getDigiLockerSignaturePolicy(env);
  const certificateXml = reportAadhaarStructure(
    xml,
    onValidationDiagnostic,
    signaturePolicy.developmentOnly,
  );
  const verification = verifyDigiLockerXmlSignature(certificateXml, {
    certificateEnvironmentKey: "IDTO_AADHAAR_XML_TRUSTED_CERT_PATH",
    // The eKYC format has no "type" attribute; the structure is enforced in
    // parseAadhaarFields on the signed content instead.
    expectedDocumentType: null,
    invalidDocumentCode: "INVALID_AADHAAR_DOCUMENT",
    env,
    onValidationDiagnostic,
  });
  return {
    ...parseAadhaarFields(verification.xml, { onValidationDiagnostic }),
    signatureVerified: verification.signatureVerified,
    developmentOnly: verification.developmentOnly,
    verificationMode: verification.mode,
  };
}

export { parseAadhaarFields, validateAadhaarXml };
export default { parseAadhaarFields, validateAadhaarXml };
