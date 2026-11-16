# AQUAPAY — Aadhaar Verification (IDTO DigiLocker)

## 1. Purpose

The Aadhaar module implements Aadhaar document verification for the AquaPay KYC workflow through the IDTO DigiLocker integration.

It is responsible for:

- Starting an authenticated Aadhaar verification session after explicit user consent.
- Redirecting the user to the DigiLocker authorization flow.
- Validating the provider callback and its single-use authorization state.
- Retrieving the Aadhaar document through the IDTO provider workflow.
- Parsing and validating the returned Aadhaar XML structure.
- Persisting verified identity data through the KYC transaction.
- Returning a masked Aadhaar identifier rather than exposing the full identifier.

Aadhaar verification is Step 2 in the KYC workflow.

## 2. Module Structure

```text
aadhaar/
├── aadhaar.controller.js
├── aadhaar.model.js
├── aadhaar.parser.js
├── aadhaar.routes.js
├── aadhaar.service.js
├── aadhaar.validator.js
├── aadhaar.test.js
└── tests/
    └── aadhaar.test.js

digilocker/
├── digilocker.controller.js
├── digilocker.errors.js
├── digilocker.mockProvider.js
├── digilocker.model.js
├── digilocker.provider.js
├── digilocker.routes.js
├── digilocker.service.js
├── digilocker.signature.js
├── digilocker.signatureConfig.js
├── digilocker.stateStore.js
├── digilocker.validator.js
└── digilocker.xml.js

shared/
├── idtoHttpClient.js
├── identityData.crypto.js
└── providerSession.crypto.js
```

The DigiLocker and shared folders are used by the Aadhaar feature; they are not exclusive to the Aadhaar folder.

## 3. API Endpoints

**Base URL:** `http://localhost:3000`

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/kyc/digilocker/aadhaar/initiate` | Bearer token | Starts Aadhaar authorization after validating consent |
| `GET` | `/api/kyc/digilocker/aadhaar/status/` | Bearer token | Retrieves the authenticated user's Aadhaar session status |
| `GET` | `/api/kyc/digilocker/callback` | Single-use callback state | Receives the DigiLocker redirect and completes verification |
| `GET` | `/api/kyc/digilocker/mock-authorize` | Mock mode only | Simulates authorization in the configured development/test mock provider |

The mock authorization route is registered only when the selected DigiLocker provider is in mock mode.

## 4. Authentication and Consent

The initiation and status endpoints use the application's authentication middleware.

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

The user ID is obtained from the verified authentication context (`req.user.id`). The client cannot choose a different user's KYC record by submitting a user ID.

### Initiation request

```http
POST /api/kyc/digilocker/aadhaar/initiate
```

```json
{
  "consent": true
}
```

The consent validator requires an object containing exactly one field, `consent`, with the boolean value `true`. Missing consent, false consent, or extra fields are rejected.

## 5. DigiLocker Authorization Flow

The backend uses the following provider sequence:

```text
1. initiate_session
        ↓
2. get_reference
        ↓
3. user_details
        ↓
4. fetch_aadhaar
```

### Step 1 — Initiate session

The service:

1. Confirms that the Aadhaar verification handler is registered.
2. Requires explicit consent.
3. Creates a verification attempt for the authenticated user.
4. Creates a single-use authorization state and session identifier.
5. Calls IDTO `initiate_session`.
6. Validates the provider's authorization response and redirect URL.
7. Returns the authorization URL, session ID, pending status, expiry information, verification type, and KYC step number.

The Aadhaar handler uses document code `ADHAR`, issuer identifier `in.gov.uidai`, and KYC step number `2`.

### Step 2 — Provider callback

IDTO redirects the user to:

```http
GET /api/kyc/digilocker/callback
```

The callback is not authenticated with the original AquaPay Bearer token. Instead, it is correlated to the authenticated initiation using the single-use state stored by the backend.

The callback validator accepts:

- `code`
- `state`
- Exactly one of `codeVerifier` or `code_verifier`
- Optional `clientId` metadata

It rejects unexpected parameters, malformed values, missing fields, and duplicate verifier representations. The optional `clientId` is not used to authenticate the callback or select a user.

The state is consumed once. Invalid, expired, or already-consumed state cannot be reused.

### Step 3 — Get reference

The backend calls IDTO `get_reference` using the authorization code and code verifier. It validates the provider response and stores the returned reference key using the provider-session storage mechanism.

### Step 4 — Retrieve Aadhaar

The Aadhaar handler calls the provider operations in this order:

1. `user_details`
2. `fetch_aadhaar`

The service rejects invalid or unsuccessful provider responses and requires a non-empty document response.

## 6. Aadhaar XML Parsing and Validation

`aadhaar.parser.js` parses the XML through the shared DigiLocker XML utilities.

The parser validates the expected document structure:

```text
Certificate
└── CertificateData
    └── KycRes
        └── UidData
            ├── Poi
            ├── Poa
            └── Pht (optional)
```

The parser checks:

- The root element is `Certificate`.
- If the document type attribute is present, it must identify `ADHAR`.
- Required elements occur exactly once.
- The KYC response status is successful (`ret="Y"`).
- A KYC error attribute is not present with a non-empty value.
- The KYC timestamp is present and syntactically valid.
- If issuer metadata is present, it matches the expected UIDAI organization.
- The UID is either a full 12-digit identifier or a supported masked identifier ending in four digits.
- Name and date of birth are present and valid.
- Address fields meet the parser's required-field and length rules.
- Optional photo data does not occur more than once.

The date of birth is normalized to `YYYY-MM-DD` after calendar-date validation. Address attributes are mapped into the application's address representation.

### XML authenticity limitation

Structural XML parsing and field validation do **not**, by themselves, prove cryptographic issuer-signature authenticity. The security-remediation review identified Aadhaar XML authenticity/signature verification as an open item. Do not treat successful parsing alone as cryptographic proof that a document was signed by UIDAI.

## 7. Persistence and Encryption

After successful parsing, the Aadhaar service passes the extracted values to the DigiLocker model's transactional completion method.

The identity persistence layer stores sensitive identity data using AES-256-GCM encryption. The implementation uses a 256-bit key, a 12-byte IV, and a 16-byte authentication tag, with key-version support and context binding.

The full Aadhaar number, when available, is stored in encrypted identity data. If the provider returns only a masked UID, that representation is retained as masked data rather than being treated as a full number.

The API result uses a masked identifier. Full Aadhaar values must not be included in ordinary API responses, logs, or analytics.

Identity-data encryption and provider-session encryption use separate keys. Never reuse the same key for both domains.

Relevant environment variables:

```env
KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION=1
KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1=<base64-encoded-32-byte-key>

KYC_PROVIDER_SESSION_ENCRYPTION_ACTIVE_KEY_VERSION=1
KYC_PROVIDER_SESSION_DEV_ENCRYPTION_KEY_V1=<base64-encoded-32-byte-key>
```

The key version and key value must match the environment and the records being accessed. For a shared database, use only the team's approved shared development keys. A syntactically valid key is not necessarily the correct key for existing encrypted records.

## 8. Status Retrieval

Request:

```http
GET /api/kyc/digilocker/aadhaar/status/?sessionId=<session-uuid>
Authorization: Bearer <access_token>
```

`sessionId` is optional. If supplied, it must be a valid UUID. The session lookup is scoped to the authenticated user. A session not found for that user returns a not-found response.

## 9. Error Handling

The implementation uses controlled API errors for cases such as:

- Missing or invalid authentication.
- Missing explicit consent.
- Unsupported verification type.
- Invalid callback parameters.
- Invalid, expired, or already-consumed authorization state.
- Provider timeout, invalid response, or operation failure.
- Invalid Aadhaar XML structure or required fields.
- Failed verification persistence.

Raw provider payloads and sensitive identity values should not be returned to the API consumer.

## 10. Local Testing

From the `backend/` directory:

```bash
npm test
```

Run the development server:

```bash
npm run dev
```

The mock DigiLocker provider is intended for development/test use. Mock verification is not a real identity verification and must not be treated as production-verified.

## 11. Verification Checklist

- [ ] Initiation requires a valid authenticated user.
- [ ] Explicit consent is required.
- [ ] A verification attempt and single-use state are created.
- [ ] Callback state is validated and consumed once.
- [ ] Provider calls follow `initiate_session → get_reference → user_details → fetch_aadhaar`.
- [ ] The reference key is stored using provider-session encryption.
- [ ] Aadhaar XML structure and required fields are validated.
- [ ] Full Aadhaar data is encrypted at rest.
- [ ] API responses expose only a masked Aadhaar identifier.
- [ ] Logs do not contain full Aadhaar values, tokens, or provider secrets.
- [ ] Cryptographic XML issuer-signature verification is separately completed and verified.
- [ ] Real IDTO callback and document retrieval are tested in the intended integration environment.

## 12. Current Status and Limitations

The Aadhaar DigiLocker workflow, consent validation, single-use callback state, provider retrieval sequence, XML structural validation, and encrypted identity persistence are implemented in the reviewed code.

The following remain distinct verification tasks:

1. Cryptographic authenticity/signature verification of Aadhaar XML.
2. Real IDTO integration and callback testing in the target environment.
3. Verification that the correct shared encryption keys can decrypt existing shared-database records.
4. End-to-end verification against the intended database and deployment configuration.

Automated tests and successful local server startup do not, by themselves, establish production readiness or regulatory compliance.
