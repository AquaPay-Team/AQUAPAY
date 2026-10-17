# AQUAPAY — Authentication Module

## 1. Purpose

The Authentication module handles user login, JWT-based authentication, password recovery, and password reset for the AQUAPAY fintech KYC backend using Node.js, Express, and MySQL.

It provides authentication middleware to protect API routes and validates authenticated users before granting access.

## 2. Folder Structure

```text
auth/
├── auth.controller.js
├── auth.service.js
├── auth.routes.js
├── auth.validator.js
├── auth.config.js
├── authRateLimit.middleware.js
├── auth.test.js
└── README.md
```

_Note: Confirm the exact filenames against the current `src/modules/auth/` directory before finalizing this tree._

## 3. Files and Responsibilities

| File                          | Responsibility                                                    |
| ----------------------------- | ----------------------------------------------------------------- |
| `auth.controller.js`          | Handles authentication requests and HTTP responses.               |
| `auth.service.js`             | Implements authentication and password-recovery business logic.   |
| `auth.routes.js`              | Defines authentication endpoints and middleware sequence.         |
| `auth.validator.js`           | Validates authentication request data.                            |
| `auth.config.js`              | Validates authentication-related configuration.                   |
| `authRateLimit.middleware.js` | Applies database-backed rate limiting to authentication requests. |
| `auth.test.js`                | Contains automated authentication tests.                          |
| `README.md`                   | Documents functionality, testing, and remaining work.             |

The JWT verification middleware is maintained separately under `src/middlewares/`.

## 4. API Endpoints

**Base URL:** `http://localhost:3000`

| Method | Endpoint                    | Purpose                                           |
| ------ | --------------------------- | ------------------------------------------------- |
| `POST` | `/api/auth/login`           | Authenticates a user and issues an access token.  |
| `POST` | `/api/auth/forgot-password` | Initiates password recovery.                      |
| `POST` | `/api/auth/reset-password`  | Resets a password using a valid recovery token.   |
| `GET`  | `/api/auth/me`              | Returns information about the authenticated user. |

### Authentication Header

Protected endpoints require a Bearer token:

```http
Authorization: Bearer <access_token>
```

The exact request-body fields and response formats should be confirmed against the implementation and validators.

## 5. Request Flow

### Login Flow

1. The client sends login credentials to `/api/auth/login`.
2. The request is validated.
3. The authentication service verifies the user and password.
4. The API issues a JWT after successful authentication.
5. The client uses the token to access protected endpoints.

### Protected Route Flow

1. The client sends a request with a Bearer token.
2. Authentication middleware verifies the JWT.
3. The middleware checks the associated user's status.
4. If authentication succeeds, the request continues to the protected route.
5. Missing, invalid, or expired tokens are rejected.

### Password Recovery Flow

1. The client requests password recovery.
2. The API initiates the reset-token workflow.
3. A hash of the reset token is stored in the database.
4. A valid reset token is used to authorize a password reset.
5. The token's expiry and usage state are checked.

The exact token-delivery mechanism should be documented after confirming the current implementation.

## 6. Implemented Functionality

- JWT-based authentication.
- Password verification using the configured password-hashing library.
- JWT validation using the configured signing algorithm and token claims.
- Authentication middleware for protected routes.
- User-status checks during authentication.
- Login, forgot-password, reset-password, and current-user endpoints.
- Database-backed authentication rate limiting.
- Password-reset token storage using token hashes.
- Reset-token expiry and usage tracking.
- Protection of the user-creation route with authentication middleware.
- Configuration validation for the JWT signing secret.
- Preservation of the existing initial schema and role seed.

## 7. Environment Configuration

- The root `.env` file contains actual local configuration.
- The root `.env.example` should document required variables using safe placeholders.
- JWT configuration must meet the application's validation requirements.
- Database connection variables must be configured correctly.
- Never commit real secrets, passwords, or tokens to Git.

Confirm the exact environment variable names and required values in the current configuration files before documenting them here.

## 8. Testing Results

The following checks were completed during the authentication integration.

| Test / Check                   | Result                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| Automated authentication tests | Passed — 19 tests, 0 failures                                            |
| Dependency verification        | Passed — `npm ls --depth=0`                                              |
| Database migration             | Authentication tables created in the local `fintech_kyc` database        |
| Initial schema and role seed   | Verified unchanged during integration                                    |
| User-creation route protection | Authentication middleware added                                          |
| JWT authentication             | Implemented; complete end-to-end verification should be performed        |
| Password recovery and reset    | Automated tests passed; full database-backed workflow should be verified |
| Production deployment          | Not yet verified                                                         |

These results describe the checks performed during integration. They do not establish that the API has been fully tested in production.

## 9. Remaining Work

- Verify all authentication endpoints against the actual MySQL database.
- Test login success and failure scenarios.
- Verify expired, invalid, and malformed JWT handling.
- Test password-reset expiry, reuse prevention, and invalid-token scenarios.
- Verify the password-recovery token-delivery mechanism.
- Test database-backed rate limiting under repeated requests.
- Confirm environment configuration for local and deployment environments.
- Review authentication error responses and sensitive-data handling.
- Complete regression testing with the user-creation and authorization modules.
- Verify all protected routes and role-sensitive operations before deployment.

## 10. Current Status

The authentication module has been integrated into `main` through Pull Request #6.

The integration includes JWT-based authentication, password-recovery endpoints, authentication middleware, database-backed rate limiting, and the authentication database migration.

The automated authentication test suite passed 19 tests during integration. Full end-to-end verification with the database, authorization rules, and deployment configuration remains necessary before marking the module production-ready.

**Testing and further updates will be documented as development continues.**
