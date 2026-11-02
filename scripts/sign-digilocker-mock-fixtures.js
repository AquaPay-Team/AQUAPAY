import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { SignedXml } from "xml-crypto";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = path.join(repoRoot, "src/modules/kyc/document-verification/digilocker/fixtures");
const certificatePath = process.env.IDTO_MOCK_SIGNING_CERT_PATH;
const privateKeyPath = process.env.IDTO_MOCK_SIGNING_KEY_PATH;

if (!certificatePath || !privateKeyPath) {
  throw new Error("Mock signing certificate and key paths are required");
}

const certificateBytes = fs.readFileSync(certificatePath);
const keyMaterialBytes = fs.readFileSync(privateKeyPath);
const certificate = new X509Certificate(certificateBytes);
let privateKey;
let keyComponentsBytes;

function encodeDerLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  for (let remaining = length; remaining > 0; remaining >>= 8) {
    bytes.unshift(remaining & 0xff);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeDerInteger(value) {
  let bytes = Buffer.from(value);
  while (bytes.length > 1 && bytes[0] === 0) bytes = bytes.subarray(1);
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return Buffer.concat([Buffer.from([0x02]), encodeDerLength(bytes.length), bytes]);
}

function encodeDerSequence(values) {
  const content = Buffer.concat(values);
  return Buffer.concat([Buffer.from([0x30]), encodeDerLength(content.length), content]);
}

if (/^-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(keyMaterialBytes.toString("utf8"))) {
  privateKey = createPrivateKey(keyMaterialBytes);
} else {
  keyComponentsBytes = keyMaterialBytes;
  const keyComponents = JSON.parse(keyComponentsBytes.toString("utf8"));
  const privateKeyDer = encodeDerSequence([
    encodeDerInteger(Buffer.from([0])),
    ...["Modulus", "Exponent", "D", "P", "Q", "DP", "DQ", "InverseQ"]
      .map((name) => encodeDerInteger(Buffer.from(keyComponents[name], "base64"))),
  ]);
  privateKey = createPrivateKey({ key: privateKeyDer, format: "der", type: "pkcs1" });
}
const privateKeyPem = privateKey.export({ type: "pkcs1", format: "pem" });
const localKeyPath = path.resolve(path.dirname(privateKeyPath), "mock-signing-key.pem");
fs.writeFileSync(localKeyPath, privateKeyPem, { mode: 0o600 });
const certificatePublicKey = certificate.publicKey.export({ type: "spki", format: "der" });
const privateKeyPublicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" });
if (!certificatePublicKey.equals(privateKeyPublicKey)) {
  throw new Error("Mock signing certificate does not match the private key");
}

function signFixture(xml) {
  const signer = new SignedXml({
    privateKey,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  signer.addReference({
    xpath: "/*",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    uri: "",
    isEmptyUri: true,
  });
  signer.computeSignature(xml);
  return `${signer.getSignedXml()}\n`;
}

const fixtures = {
  "aadhaar.xml": `<Certificate language="99" name="Aadhaar Card" type="ADHAR" number="MOCK-ADHAR-0001" issueDate="01-01-2025" status="A"><IssuedBy><Organization name="Unique Identification Authority of India" type="CG"/></IssuedBy><IssuedTo><Person uid="999999999999" name="AquaPay Mock Aadhaar" dob="01-01-1990" gender="M"><Address type="permanent" line1="42 Example Road" line2="Unit 7" house="42" landmark="Test Park" locality="Mock Layout" vtc="Fictional Town" district="Test District" pin="000000" state="Test State" country="IN"/></Person></IssuedTo><CertificateData/></Certificate>`,
  "pan.xml": `<Certificate language="99" name="PAN Card" type="PANCR" number="AAAAA0000A" issuedAt="DigiLocker" issueDate="01-01-2025" status="A"><IssuedBy><Organization name="Income Tax Department" type="CG"/></IssuedBy><IssuedTo><Person name="AquaPay Mock PAN" gender="M"/></IssuedTo><CertificateData><PAN num="AAAAA0000A" verifiedOn="01-01-2025 00:00:00"/></CertificateData></Certificate>`,
};

fs.mkdirSync(fixtureDirectory, { recursive: true });
fs.copyFileSync(certificatePath, path.join(fixtureDirectory, "mock-signing-cert.crt"));
for (const [filename, xml] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(fixtureDirectory, filename), signFixture(xml), { mode: 0o644 });
}

keyMaterialBytes.fill(0);
keyComponentsBytes?.fill(0);
