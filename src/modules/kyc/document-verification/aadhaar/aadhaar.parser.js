import {
  DigiLockerDocumentError,
  directChildrenByName,
  descendantsByName,
  getAttribute,
  normalizeXmlInput,
  parseXml,
} from "../digilocker/digilocker.xml.js";

const ADDRESS_ATTRIBUTE_MAP = Object.freeze({
  house: "house",
  street: "line1",
  lm: "landmark",
  loc: "locality",
  vtc: "vtc",
  dist: "district",
  pc: "pin",
  state: "state",
  country: "country",
});
const REQUIRED_ADDRESS_FIELDS = Object.freeze(["line1", "vtc", "state"]);
const MAX_XML_FIELD_LENGTH = 500;

function report(onValidationDiagnostic, metadata) {
  if (typeof onValidationDiagnostic !== "function") return;
  try { onValidationDiagnostic(metadata); } catch { /* Diagnostics never change validation. */ }
}

function validCalendarDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function normalizeDateOfBirth(value) {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let year;
  let month;
  let day;
  if (match) {
    [, year, month, day] = match;
  } else {
    match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) return null;
    [, day, month, year] = match;
  }
  year = Number(year);
  month = Number(month);
  day = Number(day);
  if (year < 1900 || !validCalendarDate(year, month, day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getTime() > Date.now()) return null;
  return parsed.toISOString().slice(0, 10);
}

function isValidTimestamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, y, mo, d, h, mi, s, , zone, offsetH, offsetM] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (
    !validCalendarDate(year, month, day) ||
    hour > 23 || minute > 59 || second > 59
  ) return false;
  if (zone !== "Z") {
    const hours = Number(offsetH);
    const minutes = Number(offsetM);
    if (minutes > 59 || hours > 14 || (hours === 14 && minutes !== 0)) return false;
  }
  // IDTO's supplied response format defines a timestamp but no expiry/freshness
  // window. Parse it strictly without inventing a maximum age.
  return Number.isFinite(Date.parse(value));
}

function childMap(root) {
  const certificateData = directChildrenByName(root, "CertificateData");
  const kycRes = certificateData.length === 1
    ? directChildrenByName(certificateData[0], "KycRes")
    : [];
  const uidData = kycRes.length === 1
    ? directChildrenByName(kycRes[0], "UidData")
    : [];
  const poi = uidData.length === 1
    ? directChildrenByName(uidData[0], "Poi")
    : [];
  const poa = uidData.length === 1
    ? directChildrenByName(uidData[0], "Poa")
    : [];
  const pht = uidData.length === 1
    ? directChildrenByName(uidData[0], "Pht")
    : [];
  return { certificateData, kycRes, uidData, poi, poa, pht };
}

function attributeNames(element) {
  if (!element?.attributes) return [];
  const names = [];
  for (let index = 0; index < Math.min(element.attributes.length, 24); index += 1) {
    const attribute = element.attributes.item(index);
    const name = attribute?.localName || attribute?.name;
    if (typeof name === "string") names.push(name.slice(0, 64));
  }
  return names.sort();
}

function parseAadhaarXml(input, { onValidationDiagnostic } = {}) {
  let xml;
  let document;
  try {
    xml = normalizeXmlInput(input, "INVALID_AADHAAR_DOCUMENT");
    document = parseXml(xml, "INVALID_AADHAAR_DOCUMENT");
  } catch (error) {
    report(onValidationDiagnostic, {
      validationStage: "aadhaar_xml_parse",
      documentFormat: "xml",
      contentLengthBytes: typeof input === "string" ? Buffer.byteLength(input, "utf8") : Buffer.isBuffer(input) ? input.byteLength : null,
      parserErrorCategory: error?.validationReason || "xml_parse_failed",
      validationFailureReason: error?.validationReason || "xml_parse_failed",
      requiredFieldPresence: { status: "not_evaluated" },
    });
    throw error;
  }

  const root = document.documentElement;
  const found = childMap(root);
  const [kycRes] = found.kycRes;
  const [uidData] = found.uidData;
  const [poi] = found.poi;
  const [poa] = found.poa;
  const status = kycRes?.getAttribute("ret") || "";
  const timestamp = getAttribute(kycRes, "ts");
  const rawUid = getAttribute(uidData, "uid");
  const uid = rawUid.replace(/[\s-]/g, "");
  const uidIsFull = /^\d{12}$/.test(uid);
  // UIDAI e-KYC may return a Limited KYC UID with only the final four digits
  // visible. Classify that shape without logging the value; AquaPay currently
  // requires the full UID for its encrypted identity payload, so fail closed.
  const uidIsMasked = /^(?:[x*]{4,8})\d{4}$/i.test(uid);
  const issuedBy = descendantsByName(root, "IssuedBy");
  const organizations = issuedBy.length === 1
    ? descendantsByName(issuedBy[0], "Organization")
    : [];
  const issuerPresent = issuedBy.length > 0;
  const issuerValid = !issuerPresent || (
    issuedBy.length === 1 &&
    organizations.length === 1 &&
    getAttribute(organizations[0], "name") === "Unique Identification Authority of India"
  );
  const fieldPresence = {
    certificateData: found.certificateData.length === 1,
    kycRes: found.kycRes.length === 1,
    uidData: found.uidData.length === 1,
    poi: found.poi.length === 1,
    poa: found.poa.length === 1,
    aadhaarNumber: Boolean(uidData?.hasAttribute("uid")),
    name: Boolean(poi?.hasAttribute("name")),
    dateOfBirth: Boolean(poi?.hasAttribute("dob")),
    addressLine1: Boolean(getAttribute(poa, "street") || getAttribute(poa, "house")),
    addressVtc: Boolean(getAttribute(poa, "vtc")),
    addressState: Boolean(getAttribute(poa, "state")),
    kycTimestamp: Boolean(kycRes?.hasAttribute("ts") && isValidTimestamp(timestamp)),
  };
  const diagnostic = {
    validationStage: "aadhaar_document_structure",
    documentFormat: "certificate_xml",
    contentLengthBytes: Buffer.byteLength(xml, "utf8"),
    xmlRootElementName: root.localName || root.nodeName,
    xmlNamespacePresent: Boolean(root.namespaceURI),
    xmlRootPrefixPresent: Boolean(root.prefix),
    elementCounts: {
      certificateData: found.certificateData.length,
      kycRes: found.kycRes.length,
      uidData: found.uidData.length,
      poi: found.poi.length,
      poa: found.poa.length,
      pht: found.pht.length,
    },
    elementPathsPresent: {
      Certificate: root.localName === "Certificate",
      "Certificate/CertificateData": found.certificateData.length === 1,
      "Certificate/CertificateData/KycRes": found.kycRes.length === 1,
      "Certificate/CertificateData/KycRes/UidData": found.uidData.length === 1,
      "Certificate/CertificateData/KycRes/UidData/Poi": found.poi.length === 1,
      "Certificate/CertificateData/KycRes/UidData/Poa": found.poa.length === 1,
    },
    // Attribute names are useful for schema diagnostics; values may contain identity data.
    elementAttributeNames: {
      Certificate: attributeNames(root),
      KycRes: attributeNames(kycRes),
      UidData: attributeNames(uidData),
      Poi: attributeNames(poi),
      Poa: attributeNames(poa),
    },
    kycResponseStatusClassification: !kycRes?.hasAttribute("ret")
      ? "missing"
      : status === "Y" ? "success" : status === "N" ? "failure" : "unknown",
    aadhaarIdentifierFormat: !rawUid
      ? "missing"
      : uidIsFull ? "full_12_digits" : uidIsMasked ? "masked_last_four" : "invalid",
    kycTimestampPresent: Boolean(kycRes?.hasAttribute("ts")),
    kycTimestampValid: Boolean(kycRes && isValidTimestamp(timestamp)),
    documentTypeAttributePresent: root.hasAttribute("type"),
    expectedDocumentTypeMatched: root.hasAttribute("type")
      ? getAttribute(root, "type") === "ADHAR"
      : "not_in_xml",
    expectedIssuerPresent: issuerPresent ? issuerValid : "not_in_xml",
    requiredFieldPresence: fieldPresence,
    optionalFieldPresence: {
      country: Boolean(poa?.hasAttribute("country")),
      gender: Boolean(poi?.hasAttribute("gender")),
      photo: found.pht.length === 1,
    },
    validationFailureReason: null,
  };
  report(onValidationDiagnostic, diagnostic);

  const fail = (reason) => {
    report(onValidationDiagnostic, { ...diagnostic, validationFailureReason: reason });
    throw new DigiLockerDocumentError("INVALID_AADHAAR_DOCUMENT", reason);
  };

  if (root.localName !== "Certificate") fail("certificate_root_mismatch");
  if (root.hasAttribute("type") && getAttribute(root, "type") !== "ADHAR") fail("document_type_mismatch");
  if (found.certificateData.length !== 1) fail("certificate_data_element_count_invalid");
  if (found.kycRes.length !== 1) fail("kyc_response_element_count_invalid");
  if (found.uidData.length !== 1) fail("uid_data_element_count_invalid");
  if (found.poi.length !== 1) fail("poi_element_count_invalid");
  if (found.poa.length !== 1) fail("poa_element_count_invalid");
  if (found.pht.length > 1) fail("photo_element_count_invalid");
  if (status !== "Y") fail(status === "N" ? "kyc_result_not_successful" : "kyc_result_status_unknown");
  if (kycRes.hasAttribute("err") && getAttribute(kycRes, "err")) fail("kyc_response_error_present");
  if (!isValidTimestamp(timestamp)) fail("kyc_timestamp_missing_or_invalid");
  if (!issuerValid) fail("issuer_name_mismatch");

  if (uidIsMasked) fail("aadhaar_identifier_masked_limited_kyc");
  if (!uidIsFull) fail("aadhaar_number_format_invalid");

  const verifiedName = getAttribute(poi, "name").replace(/\s+/g, " ").trim();
  if (!verifiedName || verifiedName.length > 100 || /[\u0000-\u001f\u007f]/.test(verifiedName)) {
    fail("name_invalid_or_missing");
  }
  const dateOfBirth = normalizeDateOfBirth(getAttribute(poi, "dob"));
  if (!dateOfBirth) fail("date_of_birth_invalid_or_missing");
  const gender = getAttribute(poi, "gender");
  if (gender.length > 16 || /[\u0000-\u001f\u007f]/.test(gender)) fail("gender_invalid");

  const address = {};
  for (const [xmlName, dtoName] of Object.entries(ADDRESS_ATTRIBUTE_MAP)) {
    if (!poa.hasAttribute(xmlName)) continue;
    const value = getAttribute(poa, xmlName);
    if (value.length > MAX_XML_FIELD_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
      fail("address_field_invalid");
    }
    if (value) address[dtoName] = value;
  }
  if (!address.line1 && address.house) address.line1 = address.house;
  if (!REQUIRED_ADDRESS_FIELDS.every((key) => address[key]?.trim())) {
    fail("required_address_field_missing");
  }
  if (address.pin && !/^\d{6}$/.test(address.pin)) fail("address_pin_invalid");

  // Pht is intentionally not decoded or persisted: AquaPay has no Aadhaar-photo
  // storage or image-validation policy. The bounded XML cap and duplicate check remain.
  return {
    xml,
    data: {
      aadhaarNumber: uid,
      maskedIdentifier: `XXXXXX${uid.slice(-4)}`,
      verifiedName,
      gender: gender || null,
      address: [address],
      dateOfBirth,
    },
  };
}

export { isValidTimestamp, normalizeDateOfBirth, parseAadhaarXml };
