import {
  DigiLockerDocumentError,
  descendantsByName,
  getAttribute,
  parseXml,
} from "../digilocker/digilocker.xml.js";
import { verifyDigiLockerXmlSignature } from "../digilocker/digilocker.signature.js";

function parsePanFields(xml) {
  const document = parseXml(xml, "INVALID_PAN_DOCUMENT");
  const root = document.documentElement;
  if (root.localName !== "Certificate" || getAttribute(root, "type") !== "PANCR") {
    throw new DigiLockerDocumentError("INVALID_PAN_DOCUMENT");
  }

  const issuedTo = descendantsByName(root, "IssuedTo");
  const people = issuedTo.length === 1 ? descendantsByName(issuedTo[0], "Person") : [];
  const issuedBy = descendantsByName(root, "IssuedBy");
  const organizations = issuedBy.length === 1
    ? descendantsByName(issuedBy[0], "Organization")
    : [];
  const certificateData = descendantsByName(root, "CertificateData");
  const panElements = certificateData.length === 1
    ? descendantsByName(certificateData[0], "PAN")
    : [];
  if (
    people.length !== 1 || panElements.length !== 1 || organizations.length !== 1 ||
    getAttribute(organizations[0], "name").trim() !== "Income Tax Department" ||
    getAttribute(organizations[0], "type").trim() !== "CG"
  ) {
    throw new DigiLockerDocumentError("INVALID_PAN_DOCUMENT");
  }

  const pan = getAttribute(panElements[0], "num").toUpperCase();
  const certificateNumber = getAttribute(root, "number").toUpperCase();
  const verifiedOn = getAttribute(panElements[0], "verifiedOn");
  const verifiedName = getAttribute(people[0], "name").replace(/\s+/g, " ").trim();
  if (
    !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ||
    certificateNumber !== pan ||
    !isValidPanVerificationDate(verifiedOn) ||
    !verifiedName ||
    verifiedName.length > 150 ||
    /[\u0000-\u001f\u007f]/.test(verifiedName)
  ) {
    throw new DigiLockerDocumentError("INVALID_PAN_DOCUMENT");
  }
  return { panNumber: pan, maskedIdentifier: `XXXXXX${pan.slice(-4)}`, verifiedName };
}

function isValidPanVerificationDate(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour <= 23 && minute <= 59 && second <= 59;
}

function validatePanXml(xml, { env = process.env } = {}) {
  const verification = verifyDigiLockerXmlSignature(xml, {
    certificateEnvironmentKey: "IDTO_PAN_XML_TRUSTED_CERT_PATH",
    expectedDocumentType: "PANCR",
    invalidDocumentCode: "INVALID_PAN_DOCUMENT",
    env,
  });
  return {
    ...parsePanFields(verification.xml),
    signatureVerified: verification.signatureVerified,
    developmentOnly: verification.developmentOnly,
    verificationMode: verification.mode,
  };
}

export { isValidPanVerificationDate, parsePanFields, validatePanXml };
export default { isValidPanVerificationDate, parsePanFields, validatePanXml };
