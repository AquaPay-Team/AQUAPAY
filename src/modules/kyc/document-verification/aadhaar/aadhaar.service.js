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

/**
 * IDTO formats documented:
 * - YYYY-MM-DD
 * - DDMMYYYY
 *
 * Returns normalized YYYY-MM-DD, or null for invalid/unsupported values.
 */
function normalizeAadhaarDob(value) {
  if (typeof value !== "string") return null;

  const dob = value.trim();
  let normalized;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    normalized = dob;
  } else if (/^\d{8}$/.test(dob)) {
    const day = dob.slice(0, 2);
    const month = dob.slice(2, 4);
    const year = dob.slice(4, 8);

    normalized = `${year}-${month}-${day}`;
  } else {
    return null;
  }

  return isValidDateOfBirth(normalized) ? normalized : null;
}

function normalizeName(value) {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");

  return normalized || null;
}

function createAadhaarService({
  digilocker = digilockerService,
  model = digilockerModel,
  identityModel = aadhaarIdentityModel,
  validator = validateAadhaarXml,
  env = process.env,
} = {}) {
  async function initiateVerification(userId, input = {}) {
    return digilocker.initiateAuthorization(userId, "aadhaar", input);
  }

  async function verifyAndPersist({
    attempt,
    userDetails,
    xml,
    setDiagnosticStage = () => {},
    setDocumentDiagnostics = () => {},
  }) {
    setDiagnosticStage("aadhaar_user_details_validation");

    const user = userDetails?.user;
    const userDetailsDob = normalizeAadhaarDob(user?.dob);
    const userDetailsName = normalizeName(user?.name);

    if (
      userDetails?.status !== "success" ||
      !user ||
      typeof user !== "object" ||
      !userDetailsName ||
      user.name.trim().length > 100 ||
      !userDetailsDob ||
      !["M", "F", "T"].includes(user.gender) ||
      user.eaadhaar !== "Y"
    ) {
      throw new Error("INVALID_AADHAAR_USER_DETAILS");
    }

    if (typeof xml !== "string" || !xml.trim()) {
      throw new Error("INVALID_DOCUMENT_RESPONSE");
    }

    setDiagnosticStage("aadhaar_xml_validation");

    const validatedXml = await validator(xml, {
      env,
      onValidationDiagnostic: setDocumentDiagnostics,
    });

    if (
      !validatedXml ||
      typeof validatedXml.verifiedName !== "string" ||
      !validatedXml.verifiedName.trim() ||
      typeof validatedXml.dateOfBirth !== "string" ||
      typeof validatedXml.maskedIdentifier !== "string" ||
      typeof validatedXml.signatureVerified !== "boolean" ||
      typeof validatedXml.developmentOnly !== "boolean" ||
      typeof validatedXml.verificationMode !== "string"
    ) {
      throw new Error("INVALID_AADHAAR_DOCUMENT");
    }

    const xmlDob = normalizeAadhaarDob(validatedXml.dateOfBirth);
    const xmlName = normalizeName(validatedXml.verifiedName);

    if (
      !xmlDob ||
      !xmlName ||
      xmlDob !== userDetailsDob ||
      xmlName !== userDetailsName
    ) {
      throw new Error("AADHAAR_DETAILS_MISMATCH");
    }

    const expectedVerificationMode = validatedXml.signatureVerified
      ? "issuer_certificate"
      : "development_unverified";

    if (
      validatedXml.developmentOnly !== !validatedXml.signatureVerified ||
      validatedXml.verificationMode !== expectedVerificationMode
    ) {
      throw new Error("INVALID_AADHAAR_DOCUMENT");
    }

    const extracted = {
      verifiedName: validatedXml.verifiedName.trim(),
      dateOfBirth: xmlDob,
      gender: user.gender,
      eaadhaar: user.eaadhaar,
      maskedIdentifier: validatedXml.maskedIdentifier,
      aadhaarNumber: validatedXml.aadhaarNumber,
      address: validatedXml.address,
      signatureVerified: validatedXml.signatureVerified,
      developmentOnly: validatedXml.developmentOnly,
      verificationMode: validatedXml.verificationMode,
    };

    setDiagnosticStage("aadhaar_transactional_persistence");

    const completion = await model.completeVerification({
      ...attempt,
      verificationMode: extracted.verificationMode,
      maskedIdentifier: extracted.maskedIdentifier,
      verifiedName: extracted.verifiedName,
      persistIdentity: (connection, context) =>
        identityModel.persistVerifiedIdentity(connection, {
          ...context,
          dateOfBirth: extracted.dateOfBirth,
          gender: extracted.gender,
          eaadhaar: extracted.eaadhaar,
          aadhaarNumber: extracted.aadhaarNumber,
          address: extracted.address,
        }),
      signatureVerified: extracted.signatureVerified,
    });

    return { extracted, completion };
  }

  const unregister = digilocker.registerVerificationHandler("aadhaar", {
    ...AADHAAR_HANDLER,
    verifyAndPersist,
  });

  return {
    initiateVerification,
    verifyAndPersist,
    unregister,
  };
}

const defaultService = createAadhaarService();

export const initiateVerification = defaultService.initiateVerification;
export const verifyAndPersist = defaultService.verifyAndPersist;

export {
  AADHAAR_HANDLER,
  createAadhaarService,
};

export default {
  initiateVerification,
  verifyAndPersist,
};