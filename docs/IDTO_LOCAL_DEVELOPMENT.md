# IDTO DigiLocker V1 local development

The local `.env` is configured to use the real IDTO V1 provider at `https://prod.idto.ai` and the currently registered ngrok callback. The API key and client ID remain local secrets.

## Development-only signature bypass

Set these values only for local development:

```dotenv
NODE_ENV=development
IDTO_PROVIDER_MODE=idto
IDTO_BASE_URL=https://prod.idto.ai
IDTO_SKIP_XML_SIGNATURE_VERIFICATION=true
IDTO_DEV_UNVERIFIED_DATABASE=true
DB_HOST=127.0.0.1
```

The callback must exactly match the URL registered with IDTO and end in `/api/kyc/digilocker/callback`. The bypass is refused unless the provider is real IDTO and the database host is loopback. It is refused for every environment except `development`; production startup also checks the database for development-only verification records.

## Callback parameter handling

The public IDTO V1 integration guide documents callback query parameters `code` and `code_verifier`, and says the supplied `state` is returned to the callback. The local callback adapter accepts the observed IDTO spelling `codeVerifier` and normalizes it to AquaPay's internal `code_verifier`; it also continues to accept `code_verifier` for internal callers and rejects requests containing both aliases.

The observed callback also contains `clientId`, but the public IDTO V1 guide does not define that field's meaning or guarantee it as part of the callback contract. AquaPay accepts it only as optional, untrusted metadata and discards it before service processing. It is not compared with `IDTO_CLIENT_ID`, used to select a user or KYC case, or used to authenticate the callback. The configured IDTO client ID continues to authenticate AquaPay's provider requests; the required single-use Redis state remains the callback's user/session binding. Confirm `clientId` semantics with IDTO before relying on or validating that field.

The bypass skips XML signature cryptography only. XML well-formedness, DigiLocker wrapper handling, document type, Aadhaar fields, PAN format/consistency, and KYC prerequisite validation still run. The validators return `signatureVerified: false`, `developmentOnly: true`, and `verificationMode: "development_unverified"`. The callback response uses `verificationStatus: "development_unverified"`.

The approved schema has no separate unverified verification status. To exercise the transactional Step 2/3 progression locally, the verification row uses its existing `provider` field with `idto_digilocker_v1_dev_unverified`, while the step and verification status columns take their existing completion values. The KYC status response identifies these steps in `developmentUnverifiedSteps`. This data is only for the isolated loopback development database: a production server refuses startup if any such provider marker is present. Never copy this development database into production.

## Encrypted identity storage

Apply additive migration `database/migrations/004_kyc_identity_data.sql` to the local `fintech_kyc` database before starting KYC verification. The new table stores encrypted payloads associated with the user, KYC case, and verification record. AES-256-GCM protects the full Aadhaar number, full PAN number, Aadhaar address, and date of birth. The Aadhaar verified name is saved to `users.name` and `kyc_verifications.verified_name`; only masked identifiers are returned to normal API clients.

For local development, set `KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION=1` and generate `KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1` as a Base64 encoding of 32 random bytes. Application startup validates that the active environment-specific key exists and is exactly 32 bytes; verification fails closed if key configuration is missing or invalid. For example, this PowerShell command updates only that key in the ignored local `.env` file and does not print it:

```powershell
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
$rng.Dispose()
$path = '.env'
$lines = [System.Collections.Generic.List[string]]::new([IO.File]::ReadAllLines($path))
$match = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1=') {
    $lines[$i] = "KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1=$key"
    $match = $true
  }
}
if (-not $match) { $lines.Add("KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1=$key") }
[IO.File]::WriteAllLines($path, $lines, [Text.UTF8Encoding]::new($false))
Remove-Variable key
[Array]::Clear($bytes, 0, $bytes.Length)
```

Production reads only `KYC_IDENTITY_PROD_ENCRYPTION_KEY_V<n>` variables; it never uses the development key namespace. Keep the active key version and the matching 32-byte key in the production secret manager. For rotation, provision a new versioned key, change `KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION`, re-encrypt existing rows with a controlled migration job that decrypts using each row's `encryption_key_version`, and retain old keys until every row and retained backup has been re-encrypted or expired. Back up keys separately from database backups with tightly restricted recovery access. Losing a key makes its encrypted identity records unrecoverable.

To restore normal issuer-certificate verification locally, set `IDTO_SKIP_XML_SIGNATURE_VERIFICATION=false` and configure both trusted certificate paths. If the flag is absent or false, missing or invalid issuer certificates fail closed.

## Start AquaPay

The checked-in example defaults the bypass off. For the current local `.env`, it is enabled explicitly. In PowerShell:

Apply the additive identity migration if it has not already been applied:

```powershell
Get-Content -Raw database/migrations/004_kyc_identity_data.sql |
  mysql --host=127.0.0.1 --port=3307 --user=fintech_kyc --password fintech_kyc
```

```powershell
$env:NODE_ENV = 'development'
$env:IDTO_PROVIDER_MODE = 'idto'
$env:IDTO_BASE_URL = 'https://prod.idto.ai'
$env:IDTO_SKIP_XML_SIGNATURE_VERIFICATION = 'true'
$env:IDTO_DEV_UNVERIFIED_DATABASE = 'true'
npm.cmd run dev
```

Keep the local database on `127.0.0.1` and start the existing ngrok tunnel so it forwards the registered callback URL to AquaPay's local port.

## Exercise Aadhaar Step 2

Obtain an AquaPay bearer token using the existing local login flow, then start the verification with explicit consent:

```powershell
$token = '<AquaPay bearer token>'
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$aadhaar = Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:3000/api/kyc/digilocker/aadhaar/initiate' `
  -Headers $headers -Body '{"consent":true}'
$aadhaar.data.authorizationUrl
```

Open the returned authorization URL, approve the Aadhaar document request, and let IDTO redirect through ngrok to the shared callback. A successful bypassed result is labeled `development_unverified`, never `verified`.

## Exercise PAN Step 3

Complete Aadhaar Step 2 first in the same local development database. Then start PAN authorization:

```powershell
$pan = Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:3000/api/kyc/digilocker/pan/initiate' `
  -Headers $headers -Body '{"consent":true}'
$pan.data.authorizationUrl
```

Open the returned authorization URL, approve PANCR access, and let IDTO redirect to the same callback. The shared callback dispatches from the stored verification type, and the PAN module validates its own XML and PAN fields.

This procedure makes real IDTO requests. The automated test suite uses local provider fakes and signed fictional fixtures; it never calls IDTO production.
