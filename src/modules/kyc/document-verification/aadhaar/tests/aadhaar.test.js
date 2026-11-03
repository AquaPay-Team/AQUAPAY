import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAadhaarXml } from "../aadhaar.validator.js";
import { parseAadhaarXml } from "../aadhaar.parser.js";
import aadhaarService from "../aadhaar.service.js";
import aadhaarController from "../aadhaar.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "..", "..", "digilocker", "fixtures");
function readFixture(name = "aadhaar.xml") {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

function withoutSignature(xml = readFixture()) {
  return xml.replace(/<Signature\b[\s\S]*?<\/Signature>/, "");
}

test("authenticated Aadhaar initiation uses req.user.id and ignores client-supplied customer identifiers", async () => {
  const original = aadhaarService.initiateVerification;
  let captured;
  aadhaarService.initiateVerification = async (...args) => {
    captured = args;
    return { sessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa", authorizationUrl: "https://digilocker.idto.ai/authorize", status: "PENDING" };
  };
  const response = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  try {
    await new Promise((resolve, reject) => {
      response.json = (payload) => { response.payload = payload; resolve(); return response; };
      aadhaarController.initiateVerification({
        user: { id: "52" },
        validatedInitiation: { consent: true },
        body: { customerPublicUuid: "untrusted-client-value", consent: true },
      }, response, reject);
    });
    assert.deepEqual(captured, ["52", { consent: true }]);
    assert.equal(response.statusCode, 200);
  } finally {
    aadhaarService.initiateVerification = original;
  }
});

test("IDTO Aadhaar fixture parses and validates without making a cryptographic verification claim", () => {
  const result = validateAadhaarXml(readFixture());
  assert.equal(result.aadhaarNumber, "123456789012");
  assert.equal(result.maskedIdentifier, "XXXXXX9012");
  assert.equal(result.verifiedName, "Synthetic AquaPay Person");
  assert.equal(result.gender, "M");
  assert.equal(result.dateOfBirth, "1990-05-21");
  assert.deepEqual(result.address[0], {
    house: "Synthetic Unit",
    line1: "Example Street",
    vtc: "Example Town",
    district: "Example District",
    state: "Example State",
    pin: "000001",
  });
  assert.equal(Object.hasOwn(result, "signatureVerified"), false);
  assert.equal(Object.hasOwn(result, "verificationMode"), false);
  assert.equal(Object.hasOwn(result, "photo"), false);
});

test("Aadhaar parser needs no signing certificate or bypass configuration and still validates the document", () => {
  const result = validateAadhaarXml(withoutSignature());
  assert.equal(result.verifiedName, "Synthetic AquaPay Person");
  assert.throws(() => validateAadhaarXml(withoutSignature().replace('ret="Y"', 'ret="N"')),
    { code: "INVALID_AADHAAR_DOCUMENT" });
});

test("IDTO parser accepts XML declaration, string and Buffer inputs with namespaced elements", () => {
  const xml = withoutSignature();
  assert.equal(xml.startsWith('<?xml version="1.0"'), true);
  assert.equal(parseAadhaarXml(xml).data.dateOfBirth, "1990-05-21");
  assert.equal(parseAadhaarXml(Buffer.from(xml, "utf8")).data.verifiedName, "Synthetic AquaPay Person");
  const namespaced = xml.replace("<Certificate>", '<Certificate xmlns="urn:synthetic:uidai">');
  assert.equal(parseAadhaarXml(namespaced).data.aadhaarNumber, "123456789012");
  assert.throws(() => parseAadhaarXml(Buffer.from([0xff, 0xfe])), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
});

test("IDTO document structure, status and required fields fail closed", () => {
  const xml = withoutSignature();
  const invalidDocuments = [
    xml.replace("<Certificate>", "<Other>").replace("</Certificate>", "</Other>"),
    xml.replace(/<CertificateData>|<\/CertificateData>/g, ""),
    xml.replace(/<KycRes\b[^>]*>|<\/KycRes>/g, ""),
    xml.replace(/<UidData\b[^>]*>|<\/UidData>/g, ""),
    xml.replace(/<Poi\b[^>]*\/>/, ""),
    xml.replace(/<Poa\b[^>]*\/>/, ""),
    xml.replace('ret="Y"', 'ret="N"'),
    xml.replace('ret="Y"', 'ret="SUCCESS"'),
    xml.replace('ret="Y"', 'ret="y"'),
    xml.replace('ret="Y"', 'ret="Y" err="provider-error"'),
    xml.replace(/\s+ts="[^"]+"/, ""),
    xml.replace(/\s+ts="[^"]+"/, ' ts="2025-02-30T12:05:21Z"'),
    xml.replace('uid="123456789012"', 'uid="xxxxxx1234"'),
    xml.replace('name="Synthetic AquaPay Person"', ""),
    xml.replace('dob="1990-05-21"', ""),
    xml.replace('street="Example Street"', "").replace('house="Synthetic Unit"', ""),
    xml.replace('vtc="Example Town"', ""),
    xml.replace('state="Example State"', ""),
    xml.replace("</Certificate>", ""),
    '<!DOCTYPE Certificate [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Certificate>&xxe;</Certificate>',
  ];
  for (const [index, invalidXml] of invalidDocuments.entries()) {
    assert.throws(() => parseAadhaarXml(invalidXml), {
      code: "INVALID_AADHAAR_DOCUMENT",
    }, "invalid documented Aadhaar XML case " + index);
  }
});

test("masked UID is classified safely and rejected because AquaPay requires full Aadhaar for encrypted persistence", () => {
  const maskedUid = "xxxxxx9012";
  const diagnostics = [];
  const xml = withoutSignature().replace('uid="123456789012"', `uid="${maskedUid}"`);

  assert.throws(() => parseAadhaarXml(xml, {
    onValidationDiagnostic: (metadata) => diagnostics.push(metadata),
  }), {
    code: "INVALID_AADHAAR_DOCUMENT",
    validationReason: "aadhaar_identifier_masked_limited_kyc",
  });

  const failure = diagnostics.at(-1);
  assert.equal(failure.aadhaarIdentifierFormat, "masked_last_four");
  const serialized = JSON.stringify(diagnostics);
  assert.equal(serialized.includes(maskedUid), false);
  assert.equal(serialized.includes("123456789012"), false);
});

test("POA country and optional fields may be absent while required address components remain enforced", () => {
  const result = parseAadhaarXml(withoutSignature()).data;
  assert.equal(Object.hasOwn(result.address[0], "country"), false);
  assert.equal(result.address[0].line1, "Example Street");
  assert.equal(result.address[0].vtc, "Example Town");
  assert.equal(result.address[0].state, "Example State");
  assert.throws(() => parseAadhaarXml(
    withoutSignature().replace('street="Example Street"', "").replace('house="Synthetic Unit"', ""),
  ), { code: "INVALID_AADHAAR_DOCUMENT" });
});

test("photo is ignored as opaque input; empty or malformed content is not persisted or returned", () => {
  for (const photo of ["<Pht/>", "<Pht>not-base64%%%</Pht>"]) {
    const result = parseAadhaarXml(withoutSignature().replace(/<Pht>[\s\S]*?<\/Pht>/, photo)).data;
    assert.equal(Object.hasOwn(result, "photo"), false);
    assert.equal(result.aadhaarNumber, "123456789012");
  }
  assert.throws(() => parseAadhaarXml(withoutSignature().replace(
    "</UidData>",
    "<Pht/></UidData>",
  )), { code: "INVALID_AADHAAR_DOCUMENT" });
});

test("explicit document type and issuer evidence are validated when present", () => {
  const xml = withoutSignature();
  assert.throws(() => parseAadhaarXml(xml.replace("<Certificate>", '<Certificate type="PANCR">')), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  const wrongIssuer = xml.replace(
    "</CertificateData>",
    '<IssuedBy><Organization name="Synthetic Other Issuer"/></IssuedBy></CertificateData>',
  );
  assert.throws(() => parseAadhaarXml(wrongIssuer), { code: "INVALID_AADHAAR_DOCUMENT" });
});

test("parser diagnostics contain structural facts and never identity values", () => {
  const xml = withoutSignature().replace('ret="Y"', 'ret="N"');
  const diagnostics = [];
  assert.throws(() => parseAadhaarXml(xml, {
    onValidationDiagnostic: (metadata) => diagnostics.push(metadata),
  }), { code: "INVALID_AADHAAR_DOCUMENT" });
  const failure = diagnostics.at(-1);
  assert.equal(failure.validationFailureReason, "kyc_result_not_successful");
  assert.equal(failure.kycResponseStatusClassification, "failure");
  assert.equal(failure.xmlRootElementName, "Certificate");
  const serialized = JSON.stringify(diagnostics);
  for (const value of ["123456789012", "Synthetic AquaPay Person", "1990-05-21", "Example Street", xml]) {
    assert.equal(serialized.includes(value), false);
  }
});

test("Aadhaar validator rejects malformed XML", () => {
  assert.throws(() => parseAadhaarXml("<Certificate><CertificateData>"), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
});
