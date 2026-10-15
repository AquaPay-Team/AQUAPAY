# API Contract — Initial Plan

Agree on request/response details before implementation. Protected endpoints require authentication and authorization.

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| AUTH-01 | POST | `/api/auth/login` | Authenticate user and issue JWT |
| AUTH-02 | GET | `/api/auth/me` | Return current user's safe profile |
| ROLE-01 | GET | `/api/roles` | Return roles caller may assign |
| USR-01 | POST | `/api/users` | Create a permitted child user |
| USR-02 | GET | `/api/users` | List visible users with pagination |
| USR-03 | GET | `/api/users/:id` | Read one accessible user |
| USR-04 | PUT | `/api/users/:id` | Update permitted user fields |
| USR-05 | PATCH | `/api/users/:id/status` | Change account status under policy |
| COMP-01 | POST | `/api/companies` | Create company if separate endpoint is required |
| COMP-02 | GET | `/api/companies/:id` | Read accessible company details |
| KYC-01 | POST | `/api/kyc/applications` | Create KYC application (later phase) |
| KYC-02 | GET | `/api/kyc/applications/:id` | Read KYC application (later phase) |
| KYC-03 | PATCH | `/api/kyc/applications/:id/status` | Update review status (later phase) |

## Standard success response
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {}
}
```

## Standard error response
```json
{
  "success": false,
  "message": "Invalid request",
  "code": "VALIDATION_ERROR"
}
```

## Authentication endpoints

Accounts are provisioned by controlled administrative processes; there is no public
signup endpoint. Email identifiers are trimmed and lowercased. Mobile identifiers
accept 10–15 digits with an optional leading `+`.

### `POST /api/auth/login`

Request:

```json
{ "identifier": "user@example.com", "password": "your-password" }
```

Success (`200`) returns a signed access token and a safe profile:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": "1h",
    "user": { "id": 42, "name": "Example User", "email": "user@example.com", "status": "active" }
  }
}
```

Wrong credentials, missing password hashes, pending accounts, and suspended accounts
share a generic `401 INVALID_CREDENTIALS` response. Login has IP and normalized
identifier limits; excess requests receive `429 RATE_LIMITED` with `Retry-After`.

### `GET /api/auth/me`

Send `Authorization: Bearer <jwt>`. A missing, invalid, expired, or inactive account
receives `401 UNAUTHORIZED`. The endpoint returns only current safe profile fields.

### `POST /api/auth/forgot-password`

Request: `{ "identifier": "user@example.com" }`. The endpoint always returns the
same generic `200` response. No approved delivery provider is configured, so the
current implementation does not look up accounts, create tokens, or send messages.

### `POST /api/auth/reset-password`

Request: `{ "token": "<single-use-token>", "password": "new-password" }`.
Tokens are 256-bit random values; only SHA-256 token hashes are stored. Tokens expire
after 15 minutes by default. A valid token is checked before password hashing and
consumed transactionally; invalid, expired, and reused tokens receive
`400 INVALID_RESET_TOKEN`. A successful reset invalidates all outstanding tokens for
the account. Recovery cannot be used end-to-end until delivery is configured.

## Database and security behavior

The app requires explicit `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`
settings, queries Oracle server identity at startup, and refuses MariaDB. Auth SQL
uses the original `001_initial_schema.sql` columns; no existing columns are renamed.
Apply additive migration `002_auth_security_tables.sql` to a verified development
Oracle MySQL database before using recovery or rate limiting.

JWTs use HS256 with a validated secret, issuer, audience, and expiry. Protected
requests also verify current account status against the database. Database failures
in authentication/rate-limit checks fail closed. Password resets do not revoke
already-issued JWTs. If immediate revocation becomes a requirement, a per-user token
version checked on authenticated requests is the smallest practical design, with a
schema change and an extra read; it is not added without that requirement.

## Rate-limit operations and reverse proxies

The rate-limit table's `expires_at` index supports operator-run cleanup in bounded batches. The README contains the deletion statement; it removes only expired rows and should be repeated until a batch affects zero rows. No application scheduler is installed.

Express proxy trust remains off by default. Deployments behind proxies must document and narrowly configure their trusted topology. Never trust arbitrary client-supplied `X-Forwarded-For` values for rate-limit IP identity.
