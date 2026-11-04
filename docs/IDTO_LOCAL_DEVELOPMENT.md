# IDTO DigiLocker Aadhaar workflow

## Flow and routes

Aadhaar uses exactly these IDTO operations in order:

1. `POST /verify/digilocker/initiate_session`
2. `POST /verify/digilocker/get_reference`
3. `POST /verify/digilocker/user_details`
4. `POST /verify/digilocker/fetch_aadhaar`

The shared callback is `GET /api/kyc/digilocker/callback`. Authenticated initiation is `POST /api/kyc/digilocker/aadhaar/initiate` with `{"consent":true}`. The authenticated status route is `GET /api/kyc/digilocker/aadhaar/status/` and accepts an optional `sessionId` query parameter. Status is read from MySQL and returns only session status, progress, and a safe failure code.

The user ID comes from AquaPay's existing bearer-token authentication (`req.user.id`). The current `users` schema does not contain a customer public UUID, so the backend does not treat a client-supplied UUID as authorization or resolve one to a user. If an upstream integration requires a public customer UUID, it must supply an existing authenticated-user mapping before this API can use it.

Authorization state hashes, session ownership, expiry, callback consumption, workflow stage, and encrypted reference keys are stored in MySQL in `kyc_digilocker_sessions`. State is opaque, single-use, and expires after ten minutes. DigiLocker workflow state does not use Redis; Redis remains available to unrelated application features. The callback contract documented by IDTO returns `code` and `code_verifier`; AquaPay also normalizes the observed `codeVerifier` spelling. The verifier is accepted only with the state-bound callback and is sent to IDTO for the code exchange. AquaPay does not invent a PKCE challenge parameter.

The reference key is encrypted at rest with AES-256-GCM, a fresh 12-byte IV, a 16-byte authentication tag, versioned environment keys, and additional authenticated data bound to session, user, case, and verification IDs. Reference-key ciphertext is cleared on terminal success/failure. Aadhaar values and address/DOB continue to use the existing encrypted identity-data table and transaction.

## Database setup

The development database used for verification has migrations `006_kyc_identity_data.sql` and `008_digilocker_kyc_sessions.sql` recorded in `schema_migrations`; the session table and its indexes/foreign keys are present. For another development database, inspect its migration history first, then use the project migration runner so already-applied migrations are skipped:

```powershell
node database/migrate.js
```

Do not pipe migration files directly to MySQL or rerun them without checking `schema_migrations`. The server checks that `kyc_digilocker_sessions` exists at startup.

## Required local configuration

Keep the existing real provider configuration in the ignored local `.env`:

```dotenv
NODE_ENV=development
IDTO_PROVIDER_MODE=idto
IDTO_BASE_URL=https://prod.idto.ai
IDTO_CLIENT_ID=<configured locally>
IDTO_API_KEY=<configured locally>
IDTO_REDIRECT_URL=<registered HTTPS callback ending in /api/kyc/digilocker/callback>
```

The identity-data encryption key is required for Aadhaar payload persistence:

```dotenv
KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION=1
KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1=<base64 of 32 random bytes>
```

The session reference-key encryption uses a separate key:

```dotenv
KYC_PROVIDER_SESSION_ENCRYPTION_ACTIVE_KEY_VERSION=1
KYC_PROVIDER_SESSION_DEV_ENCRYPTION_KEY_V1=<base64 of a different 32 random bytes>
```

Generate independent values and write them directly to the ignored local `.env` without displaying them:

```powershell
function Set-LocalEncryptionKey([string]$name) {
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 32
  $rng.GetBytes($bytes)
  $key = [Convert]::ToBase64String($bytes)
  $path = '.env'
  $lines = [System.Collections.Generic.List[string]]::new([IO.File]::ReadAllLines($path))
  $pattern = '^' + [Regex]::Escape($name) + '='
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) { $lines[$i] = "$name=$key"; $found = $true }
  }
  if (-not $found) { $lines.Add("$name=$key") }
  [IO.File]::WriteAllLines($path, $lines, [Text.UTF8Encoding]::new($false))
  $rng.Dispose()
  Remove-Variable key
  [Array]::Clear($bytes, 0, $bytes.Length)
}
Set-LocalEncryptionKey 'KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1'
Set-LocalEncryptionKey 'KYC_PROVIDER_SESSION_DEV_ENCRYPTION_KEY_V1'
```

Use a separate secret-manager key in production for each key family. Retain prior key versions until encrypted rows and retained backups have been re-encrypted or expired. Back up keys separately from database backups; loss of a key makes its corresponding encrypted data unrecoverable. Never reuse a local key in production.

The application still validates the existing signature-policy configuration because PAN retains its existing verification behavior. `IDTO_PAN_XML_TRUSTED_CERT_PATH` is a PAN setting. No Aadhaar certificate setting or Aadhaar signature bypass is used by the Aadhaar validator.

## Local workflow

Start the backend after MySQL, Redis (for unrelated existing application features), the migrations, and local encryption keys are ready:

```powershell
$env:NODE_ENV = 'development'
$env:IDTO_PROVIDER_MODE = 'idto'
$env:IDTO_BASE_URL = 'https://prod.idto.ai'
npm.cmd run dev
```

Start authorization using an existing AquaPay bearer token:

```powershell
$token = '<AquaPay bearer token>'
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$aadhaar = Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:3000/api/kyc/digilocker/aadhaar/initiate' `
  -Headers $headers -Body '{"consent":true}'
$aadhaar.data.authorizationUrl
```

Open the returned URL, complete IDTO/DigiLocker authorization, and allow the redirect to reach the configured callback. Check persisted status with:

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:3000/api/kyc/digilocker/aadhaar/status/?sessionId=$($aadhaar.data.sessionId)" `
  -Headers @{ Authorization = "Bearer $token" }
```

This performs real IDTO requests. Automated tests use local provider fakes and fictional data only; they do not make production requests.

## Aadhaar validation and trust boundary

Aadhaar XML parsing is not XML signature verification. AquaPay requires well-formed, size-limited XML; a `Certificate/CertificateData/KycRes/UidData` structure; exactly one `ret="Y"`; a valid timestamp; valid Aadhaar, name, DOB, and required address fields; and any document type or issuer evidence present in the XML to match the expected Aadhaar/UIDAI values. Optional POA country and photo content are not persisted. The parser never claims the XML signature is verified.

The public IDTO integration guide currently documents `issued_docs` and `get_issued_docs_xml`, and does not document the `user_details` or `fetch_aadhaar` operations described in this integration request. Confirm that the production tenant exposes the four configured `/verify/digilocker/...` operations and that `fetch_aadhaar` is the intended raw XML endpoint before live testing. Because this implementation intentionally does not verify XML signatures, it cannot establish cryptographic document authenticity; use only if the organization's approved trust model accepts IDTO's returned XML as the source and obtain that assurance from IDTO/compliance separately.

## PAN

PAN remains in the existing PAN module and retains its existing `issued_docs` / `get_issued_docs_xml` retrieval, parser, persistence, and signature policy. Aadhaar-only provider changes do not replace PAN behavior.
