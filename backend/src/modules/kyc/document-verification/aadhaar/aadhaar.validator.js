import { parseAadhaarXml } from "./aadhaar.parser.js";

function validateAadhaarXml(input, { onValidationDiagnostic } = {}) {
  return parseAadhaarXml(input, { onValidationDiagnostic }).data;
}

export { validateAadhaarXml };
export default { validateAadhaarXml };
