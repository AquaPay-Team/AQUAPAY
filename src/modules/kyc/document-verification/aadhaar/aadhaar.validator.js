import {
  DigiLockerDocumentError,
  descendantsByName,
  extractCertificateXml,
  getAttribute,
  parseXml,
  verifyDigiLockerXmlSignature,
} from "../digilocker/digilocker.signature.js";
import { getDigiLockerSignaturePolicy } from "../digilocker/digilocker.signatureConfig.js";

function reportAadhaarDiagnostic(onValidationDiagnostic, metadata) {
  if (typeof onValidationDiagnostic !== "function") return;
  try {
    onValidationDiagnostic(metadata);
  } catch {
    // Diagnostics must never affect document validation.
  }
}

function reportAadhaarStructure(xml, onValidationDiagnostic, signatureBypassActive) {
  let providerXmlFormat = null;
  let providerXmlRootElementName = null;
  let providerXmlNamespace = null;
  const certificateXml = extractCertificateXml(xml, "INVALID_AADHAAR_DOCUMENT", (metadata) => {
    if (metadata?.validationStage === "provider_xml_container") {
      providerXmlFormat = metadata.documentFormat;
      providerXmlRootElementName = metadata.xmlRootElementName;
      providerXmlNamespace = metadata.xmlNamespace;
    }
    reportAadhaarDiagnostic(onValidationDiagnostic, { ...metadata, signatureBypassActive });
  });
  const root = parseXml(certificateXml, "INVALID_AADHAAR_DOCUMENT").documentElement;
  const issuedTo = descendantsByName(root, "IssuedTo");
  const people = issuedTo.length === 1 ? descendantsByName(issuedTo[0], "Person") : [];
  const issuedBy = descendantsByName(root, "IssuedBy");
  const organizations = issuedBy.length === 1
    ? descendantsByName(issuedBy[0], "Organization")
    : [];
  const person = people.length === 1 ? people[0] : null;
  const organization = organizations.length === 1 ? organizations[0] : null;
  const addresses = person ? descendantsByName(person, "Address") : [];

  reportAadhaarDiagnostic(onValidationDiagnostic, {
    validationStage: "aadhaar_document_structure",
    documentFormat: "certificate_xml",
    providerDocumentFormat: providerXmlFormat,
    providerXmlRootElementName,
    providerXmlNamespace,
    xmlRootElementName: root.localName,
    xmlRootPrefixPresent: Boolean(root.prefix),
    documentTypeAttributePresent: root.hasAttribute("type"),
    expectedDocumentTypeMatched: getAttribute(root, "type") === "ADHAR",
    expectedIssuerPresent: Boolean(
      organization && getAttribute(organization, "name") === "Unique Identification Authority of India",
    ),
    requiredFieldPresence: {
      issuedTo: issuedTo.length === 1,
      person: Boolean(person),
      aadhaarNumber: Boolean(person?.hasAttribute("uid")),
      name: Boolean(person?.hasAttribute("name")),
      dateOfBirth: Boolean(person?.hasAttribute("dob")),
      address: addresses.length > 0,
      addressLine1: addresses.some((entry) => Boolean(getAttribute(entry, "line1"))),
      addressVtc: addresses.some((entry) => Boolean(getAttribute(entry, "vtc"))),
      addressState: addresses.some((entry) => Boolean(getAttribute(entry, "state"))),
      addressCountry: addresses.some((entry) => Boolean(getAttribute(entry, "country"))),
    },
    validationFailureReason: null,
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
      expectedDocumentTypeMatched: false,
      expectedIssuerPresent: "not_evaluated",
      requiredFieldPresence: { status: "not_evaluated" },
      validationFailureReason: "xml_parse_failed",
    });
    throw error;
  }

  const root = document.documentElement;
  const documentTypeAttributePresent = root.hasAttribute("type");
  const expectedDocumentTypeMatched = getAttribute(root, "type") === "ADHAR";
  const issuedTo = descendantsByName(root, "IssuedTo");
  const people = issuedTo.length === 1 ? descendantsByName(issuedTo[0], "Person") : [];
  const issuedBy = descendantsByName(root, "IssuedBy");
  const organizations = issuedBy.length === 1
    ? descendantsByName(issuedBy[0], "Organization")
    : [];
  const person = people.length === 1 ? people[0] : null;
  const organization = organizations.length === 1 ? organizations[0] : null;
  const addressElements = person ? descendantsByName(person, "Address") : [];
  const requiredFieldPresence = {
    issuedTo: issuedTo.length === 1,
    person: Boolean(person),
    aadhaarNumber: Boolean(person?.hasAttribute("uid")),
    name: Boolean(person?.hasAttribute("name")),
    dateOfBirth: Boolean(person?.hasAttribute("dob")),
    address: addressElements.length > 0,
    addressLine1: addressElements.some((entry) => Boolean(getAttribute(entry, "line1"))),
    addressVtc: addressElements.some((entry) => Boolean(getAttribute(entry, "vtc"))),
    addressState: addressElements.some((entry) => Boolean(getAttribute(entry, "state"))),
    addressCountry: addressElements.some((entry) => Boolean(getAttribute(entry, "country"))),
  };
  const expectedIssuerPresent = Boolean(
    organization && getAttribute(organization, "name") === "Unique Identification Authority of India",
  );
  const baseDiagnostic = {
    validationStage: "aadhaar_identity_fields",
    documentFormat: "certificate_xml",
    xmlRootElementName: root.localName,
    xmlRootPrefixPresent: Boolean(root.prefix),
    documentTypeAttributePresent,
    expectedDocumentTypeMatched,
    expectedIssuerPresent,
    requiredFieldPresence,
  };
  const fail = (reason) => {
    reportAadhaarDiagnostic(onValidationDiagnostic, {
      ...baseDiagnostic,
      validationFailureReason: reason,
    });
    throw new DigiLockerDocumentError("INVALID_AADHAAR_DOCUMENT");
  };

  if (root.localName !== "Certificate") fail("certificate_root_mismatch");
  if (!documentTypeAttributePresent) fail("document_type_missing");
  if (!expectedDocumentTypeMatched) fail("document_type_mismatch");
  if (issuedTo.length !== 1) fail("issued_to_element_count_invalid");
  if (people.length !== 1) fail("person_element_count_invalid");
  if (issuedBy.length !== 1) fail("issued_by_element_count_invalid");
  if (organizations.length !== 1) fail("issuer_organization_count_invalid");
  if (!expectedIssuerPresent) fail("issuer_name_mismatch");

  const uid = getAttribute(person, "uid").replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(uid)) fail("aadhaar_number_format_invalid");

  const verifiedName = getAttribute(person, "name").replace(/\s+/g, " ").trim();
  if (!verifiedName || verifiedName.length > 100 || /[\u0000-\u001f\u007f]/.test(verifiedName)) {
    fail("name_invalid_or_missing");
  }

  const birthDate = getAttribute(person, "dob");
  const dobMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(birthDate);
  if (!dobMatch) fail("date_of_birth_format_invalid");
  const [, dayText, monthText, yearText] = dobMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const dobDate = new Date(Date.UTC(year, month - 1, day));
  if (
    dobDate.getUTCFullYear() !== year || dobDate.getUTCMonth() !== month - 1 ||
    dobDate.getUTCDate() !== day || year < 1900 || dobDate.getTime() > Date.now()
  ) fail("date_of_birth_invalid");

  const addressFields = ["type", "line1", "line2", "house", "landmark", "locality", "vtc", "district", "pin", "state", "country"];
  if (addressElements.length < 1 || addressElements.length > 8) fail("address_element_count_invalid");
  const address = addressElements.map((element) => {
    const entry = {};
    for (const field of addressFields) {
      if (!element.hasAttribute(field)) continue;
      const value = getAttribute(element, field).trim();
      if (/[\u0000-\u001f\u007f]/.test(value) || value.length > 500) {
        fail("address_field_value_invalid");
      }
      entry[field] = value;
    }
    if (!["line1", "vtc", "state", "country"].every((field) => entry[field]?.trim())) {
      fail("required_address_field_missing");
    }
    return entry;
  });

  reportAadhaarDiagnostic(onValidationDiagnostic, {
    ...baseDiagnostic,
    validationFailureReason: null,
  });

  return {
    aadhaarNumber: uid,
    maskedIdentifier: `XXXXXX${uid.slice(-4)}`,
    verifiedName,
    address,
    dateOfBirth: `${yearText}-${monthText}-${dayText}`,
  };
}

function validateAadhaarXml(xml, { env = process.env, onValidationDiagnostic } = {}) {
  const signaturePolicy = getDigiLockerSignaturePolicy(env);
  const certificateXml = reportAadhaarStructure(
    xml,
    onValidationDiagnostic,
    signaturePolicy.developmentOnly,
  );
  const verification = verifyDigiLockerXmlSignature(certificateXml, {
    certificateEnvironmentKey: "IDTO_AADHAAR_XML_TRUSTED_CERT_PATH",
    expectedDocumentType: "ADHAR",
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
