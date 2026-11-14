# AQUAPAY — PAN Verification (IDTO PAN Detailed v2)

## 1. Purpose

The PAN verification module implements PAN verification as Step 3 of the AquaPay KYC workflow.

It uses the IDTO PAN Detailed v2 API and requires an already verified Aadhaar identity. The backend obtains the verified Aadhaar name from persisted KYC data, sends it to the provider with the submitted PAN and consent, validates the provider response, compares the returned PAN name with the Aadhaar name, and completes the PAN KYC step only when the checks succeed.

## 2. Module Structure

```text
pan/
├── pan.controller.js
├── pan.model.js
├── pan.nameMatching.js
├── pan.provider.js
├── pan.routes.js
├── pan.service.js
├── pan.validator.js
└── tests/
    ├── pan.model.test.js
    ├── pan.nameMatching.test.js
    ├── pan.service.test.js
    ├── pan.test.js
    └── pan.validator.test.js

shared/
└── idtoHttpClient.js
```

The shared IDTO HTTP client is used for provider communication and response handling.

## 3. API Endpoint

**Base URL:** `http://localhost:3000`

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/kyc/pan/verify` | Bearer token | Verifies the submitted PAN through IDTO and checks the returned name against verified Aadhaar data |

### Authentication header

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

The user ID is taken from the authenticated request context (`req.user.id`). The client cannot choose another user's KYC record.

## 4. Request Specification

Request:

```http
POST /api/kyc/pan/verify
```

```json
{
  "panNumber": "<PAN_NUMBER>",
  "consent": true
}
```

### Request fields

| Field | Required | Validation |
|---|---|---|
| `panNumber` | Yes | String; trimmed and converted to uppercase; must match `^[A-Z]{5}[0-9]{4}[A-Z]$` |
| `consent` | Yes | Must be the boolean value `true` |

The validator rejects non-object bodies, arrays, unexpected properties, invalid PAN formats, and missing/false consent.

## 5. Aadhaar Prerequisite

PAN verification depends on previously verified Aadhaar data.

Before calling IDTO, the service:

1. Confirms the request has an authenticated user ID.
2. Retrieves the verified Aadhaar name for that user from the DigiLocker/KYC model.
3. Rejects missing, ambiguous, or invalid Aadhaar identity data.
4. Validates that the trusted Aadhaar name is non-empty, bounded in length, and free of control characters.
5. Creates a pending PAN verification attempt with the provider identity.

The PAN name sent to IDTO is sourced from the verified Aadhaar record. It is not accepted from the client request.

## 6. IDTO PAN Detailed v2 Integration

The real provider sends a JSON request to:

```text
POST /v2/verify/pan_detailed
```

Request body sent by the backend:

```json
{
  "pan_number": "<PAN_NUMBER>",
  "user_consent": true,
  "name": "<VERIFIED_AADHAAR_NAME>"
}
```

The provider implementation uses the shared IDTO HTTP client and expects the response to contain the documented top-level fields `status`, `error_code`, and `data`.

### Expected successful response shape

```json
{
  "status": "success",
  "error_code": null,
  "data": {
    "pan_number": "<PAN_NUMBER>",
    "full_name": "<NAME_RETURNED_BY_PROVIDER>"
  }
}
```

The response validator requires:

- `status` to equal `success`.
- `error_code` to be `null`.
- `data` to be a non-array object.
- `pan_number` to match the expected PAN format.
- `full_name` to be a non-empty bounded string without control characters.

The service also checks that the PAN returned by the provider exactly matches the PAN submitted by the user.

## 7. PAN and Aadhaar Name Matching

The comparison is implemented in `pan.nameMatching.js`.

Both names are normalized by:

1. Applying Unicode NFKC normalization.
2. Converting text to lowercase.
3. Replacing punctuation with spaces.
4. Collapsing repeated whitespace.
5. Splitting into name tokens.
6. Sorting the tokens.
7. Comparing token counts and each token for exact equality.

This is an exact token-multiset comparison after normalization. It is not fuzzy matching, phonetic matching, transliteration, or an inference that different spellings refer to the same person.

If the normalized names do not match, the service returns `PAN_NAME_MISMATCH` and does not complete the PAN KYC step.

## 8. Verification and Persistence Flow

```text
Authenticated request
        ↓
Validate PAN format and explicit consent
        ↓
Load verified Aadhaar name
        ↓
Check Aadhaar prerequisite and KYC case state
        ↓
Create pending PAN verification attempt
        ↓
Call IDTO PAN Detailed v2
        ↓
Validate provider response and returned PAN
        ↓
Compare provider name with Aadhaar name
        ↓
Persist successful PAN verification
        ↓
Complete KYC Step 3
```

On success, the service returns the masked PAN identifier, verification status, step number, and KYC progress.

The successful result identifies Step 3. The full PAN should not be exposed in ordinary API responses or logs.

If a verification attempt fails, the service attempts to persist a sanitized failure code for that attempt. Failure to persist the failure status is logged using a bounded diagnostic code rather than the raw sensitive payload.

## 9. Mock Provider

The PAN provider supports a mock mode for development and test environments.

The mock provider:

- Is available only when `NODE_ENV` is `development` or `test`.
- Validates the PAN request shape, consent, and name.
- Returns a simulated successful response for test execution.
- Is explicitly marked as a mock provider.

A mock result is returned with:

```json
{
  "status": "development_unverified",
  "developmentOnly": true
}
```

A mock response is not a real PAN verification and must never be represented as production-verified.

## 10. Error Handling

The service maps validation, KYC-state, and provider errors into controlled API errors.

Examples include:

| Condition | API error / behavior |
|---|---|
| Missing authentication | `401 Unauthorized` |
| Invalid PAN format | `PAN_NUMBER_INVALID` |
| Missing consent | `PAN_CONSENT_REQUIRED` |
| Aadhaar not completed | `AADHAAR_PREREQUISITE_NOT_COMPLETED` |
| Aadhaar name unavailable or ambiguous | `AADHAAR_VERIFIED_NAME_UNAVAILABLE` / controlled Aadhaar availability error |
| PAN step already completed | `PAN_ALREADY_VERIFIED` |
| PAN attempt already in progress | `PAN_VERIFICATION_IN_PROGRESS` |
| Provider response malformed | `PAN_PROVIDER_INVALID_RESPONSE` |
| Returned PAN differs from submitted PAN | Provider response rejected |
| PAN name differs from Aadhaar name | `PAN_NAME_MISMATCH` |
| Provider timeout/unavailability | Controlled `503` response |

Known provider error codes are mapped through the provider error map. Unexpected provider failures use a generic temporary-unavailability response. Raw provider responses should not be exposed to clients.

## 11. Local Testing

From the `backend/` directory:

```bash
npm test
```

The PAN test files cover:

- Request validation.
- Name normalization and matching.
- Service prerequisite checks.
- Provider response validation.
- Provider mock-mode restrictions.
- Success and failure handling.
- Controller response behavior.

Use test data and a non-production environment when exercising the verification workflow.

## 12. Verification Checklist

- [ ] Request requires a valid authenticated user.
- [ ] PAN input is normalized and validated.
- [ ] Explicit consent is required.
- [ ] Aadhaar verification must already be completed.
- [ ] Aadhaar name is loaded from persisted verified data, not from client input.
- [ ] Pending verification is created before the provider call.
- [ ] IDTO response structure and returned PAN are validated.
- [ ] PAN name is compared with the verified Aadhaar name.
- [ ] Name mismatch does not complete Step 3.
- [ ] Successful response contains only a masked PAN identifier.
- [ ] Failure attempts store sanitized failure codes.
- [ ] Mock results are marked development-only and unverified.
- [ ] PAN values and provider credentials are not written to logs.

## 13. Current Status and Limitations

The reviewed PAN implementation includes the authenticated verification endpoint, request validation, Aadhaar prerequisite, IDTO PAN Detailed v2 provider, response validation, exact normalized name-token comparison, attempt persistence, controlled error mapping, and a development/test mock provider.

A successful automated test or mock response does not establish that the real IDTO provider is configured, reachable, or production-ready. Real provider credentials, provider-side behavior, deployment configuration, and end-to-end integration must be verified in the intended environment.
