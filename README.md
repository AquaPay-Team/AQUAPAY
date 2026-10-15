# Fintech KYC Backend

Shared starter structure for the team. Stack: Node.js, Express, MySQL, MVC + service layer.

## Requirements
- Node.js LTS and npm
- MySQL Server
- Git

## Setup
1. Copy `.env.example` to `.env` and fill in your local values. Never commit `.env`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create the database and tables using the SQL files in `database/migrations/`.
4. Start in development:
   ```bash
   npm run dev
   ```

The server starts on `http://localhost:3000`. `GET /api/health` is a basic health check.

## Architecture
- `routes/`: URL-to-controller mappings
- `controllers/`: HTTP request/response handling
- `services/`: business rules and hierarchy checks
- `models/`: parameterized SQL and data access
- `middlewares/`: authentication, authorization, error handling
- `validators/`: request validation
- `config/`: shared configuration, including database connection
- `database/migrations/`: versioned SQL schema
- `database/seeds/`: development reference data

## Team rules
- Agree on API request/response contracts before parallel implementation.
- Use parameterized queries; never concatenate untrusted input into SQL.
- Never commit `.env`, credentials, tokens, or real KYC data.
- Do not expose public signup that grants the Admin role. Bootstrap the first Admin through a controlled one-time script.
- `created_by` is the account that created a user; `parent_user_id` is the business hierarchy parent. Keep their meanings distinct.
- Do not return password hashes in API responses.

## Oracle MySQL and Authentication

The application requires **Oracle MySQL Community Server**; MariaDB is not supported.
Startup checks the configured server identity and refuses MariaDB rather than
silently using it. The initial schema uses MySQL 8-compatible SQL and retains the
existing `full_name`, `company_name`, and `parent_user_id` column names. The project
was exercised with Node.js 26.7.0; require Node.js 20.13.0 or newer (the dev script
uses Node's built-in watch mode) and Oracle MySQL 8 or newer.

### Local setup

1. Install and initialize Oracle MySQL through the official MySQL Installer/Configurator.
   Inspect existing config and data paths first; never initialize over existing data.
2. Find the installed service name with `Get-Service *mysql*` and start only the
   verified Oracle MySQL service. If port `3306` is occupied, configure Oracle MySQL
   on a free port such as `3307`; do not stop or repurpose XAMPP/MariaDB.
3. Review and apply `database/migrations/001_initial_schema.sql` to a new, verified
   development database. Apply `database/seeds/001_roles.sql` only for a fresh
   database, then apply `database/migrations/002_auth_security_tables.sql`. The app
   never runs migrations automatically.
4. Create an application database account with least privilege after schema setup.
   Copy `.env.example` to `.env` and fill in the local connection values. `.env` is
   ignored by Git. No credentials belong in source control.
5. Run `npm install`, `npm test`, and `npm run dev`. Startup validates configuration,
   connects to the selected DB, verifies Oracle MySQL identity, and only then starts
   the HTTP listener. `GET /api/health` is a basic liveness endpoint.

Do not point the application at an existing MariaDB database. Port 3307 is the sample
Oracle MySQL port because a local service may already own 3306. No database is
created or migrated by startup.

### Auth API

- `POST /api/auth/login`: `{ "identifier": "user@example.com", "password": "…" }`
- `GET /api/auth/me`: requires `Authorization: Bearer <jwt>` and returns a safe
  profile for the current active account.
- `POST /api/auth/forgot-password`: `{ "identifier": "user@example.com" }`
- `POST /api/auth/reset-password`: `{ "token": "…", "password": "new-password" }`

Login uses email or a 10–15 digit mobile number. Pending and suspended accounts are
rejected with the same generic `401` used for invalid credentials. Login and recovery
endpoints have shared MySQL-backed rate limits. Input JSON is limited to 16 KiB.
Reset tokens are 256-bit random values stored only as SHA-256 hashes, expire after 15
minutes by default, and are checked before bcrypt hashing and consumed transactionally.
No email/SMS provider is configured, so forgot-password always responds generically
without creating or delivering a token. Recovery is not end-to-end until an approved
provider is configured and tested.

The access token is stateless with a one-hour default expiry. Password reset does not
immediately revoke tokens already issued. If immediate revocation becomes a concrete
requirement, add a per-user token version checked on authenticated requests; this
requires a schema change and an extra read per request. It is not added by default.

Required environment values and safe placeholders are listed in `.env.example`.
Set `JWT_SECRET` to at least 32 random bytes. Schedule bounded cleanup for expired
rows in the authentication tables. Tests use mocks and do not replace verification
against a real Oracle MySQL test database.

### Rate-limit cleanup and reverse proxies

The rate-limit table has an index on `expires_at`. An authorized database operator should periodically delete only expired rows in bounded batches, repeating this statement until it affects zero rows:

```sql
DELETE FROM auth_rate_limits
WHERE expires_at < UTC_TIMESTAMP()
ORDER BY expires_at
LIMIT 1000;
```

The predicate preserves active rows, and the limit avoids one unbounded delete. Use the deployment's existing authorized database maintenance process; the API does not run cleanup or add a scheduler. The auth migration supplies the `expires_at` index used by this cleanup.

Express `trust proxy` defaults to `false` here, so client-supplied `X-Forwarded-For` values do not determine the rate-limit IP. Behind a reverse proxy, requests share the proxy peer IP unless the deployment configures trusted proxies. Configure trust only after documenting the exact proxy topology, and restrict it to known proxy addresses/subnets or a topology-appropriate hop count. Enabling trust indiscriminately is unsafe: a proxy that forwards arbitrary client headers can let clients spoof their apparent IP and bypass IP-based limits. The edge proxy must sanitize or overwrite forwarded headers before Express trusts them.
