# AquaPay --- Users API

API testing notes and branch-push checklist for the AquaPay Users
module.

> **Purpose:** Document the tested user-management API behavior,
> utility-helper integration, local setup notes, and the checks required
> before pushing changes to a feature branch.

## API Details

  Field               Value
  ------------------- ---------------------------
  API / feature       Users API --- Create User
  Method + endpoint   `POST /api/users`
  Health endpoint     `GET /api/health`
  Local base URL      `http://localhost:3000`
  Branch name         feature/user-creation-api
  Date / developer    feature/user-creation-api

## 1. Start the Server

From the AquaPay project root:

``` bash
npm start
```

Expected startup message:

``` text
AquaPay API listening on port http://localhost:3000
```

Confirm the server is running using the health endpoint.

## 2. Test Every Endpoint

Use Postman and record the actual result for each applicable test.

### Test 1 --- Health Check

-   **Method:** `GET`
-   **URL:** `http://localhost:3000/api/health`
-   **Expected status:** `200 OK`

Expected response:

``` json
{
  "success": true,
  "message": "AquaPay is running"
}
```

### Test 2 --- Validation Error

-   **Method:** `POST`
-   **URL:** `http://localhost:3000/api/users`
-   **Headers:** `Content-Type: application/json`, `x-user-id: 1`
-   **Expected status:** `400 Bad Request`

Request body:

``` json
{
  "name": "A",
  "email": "invalid-email",
  "password": "123"
}
```

Expected behavior: validation rejects the request and reports the
invalid name, email, missing mobile number, short password, and missing
role. The exact response should match the implementation's current
validation contract.

### Test 3 --- Missing Authentication

-   **Method:** `POST`
-   **URL:** `http://localhost:3000/api/users`
-   **Headers:** `Content-Type: application/json`; omit `x-user-id`
-   **Expected status:** `401 Unauthorized`

Request body:

``` json
{
  "name": "Jane SubAdmin",
  "email": "jane@aquapay.com",
  "mobile": "9876543210",
  "password": "Use-A-Test-Password-Only",
  "role_id": 2
}
```

Expected behavior: the API rejects the request with an `UNAUTHORIZED`
error because no authenticated creator is supplied.

### Test 4 --- Successful User Creation

-   **Method:** `POST`
-   **URL:** `http://localhost:3000/api/users`
-   **Headers:** `Content-Type: application/json`, `x-user-id: 1`
-   **Expected status:** `201 Created`

Request body:

``` json
{
  "name": "Jane SubAdmin",
  "email": "jane.subadmin@example.com",
  "mobile": "9876543210",
  "password": "Use-A-Test-Password-Only",
  "role_id": 2
}
```

Expected behavior: the API creates the user and returns a success
response containing the new user's public fields, role information,
company, parent, and status. Verify the generated ID and stored database
row. Do not expect the plaintext password to be returned.

**Database prerequisite:** an active Admin user with ID `1` and the
required role/company data must exist in the local test database.

### Test 5 --- Duplicate Email or Mobile

Send the successful creation request again using the same email or
mobile number.

-   **Expected status:** `409 Conflict`
-   **Expected error code:** `DUPLICATE_ENTRY`

Expected behavior: the duplicate is rejected and no second user is
created. The exact message may identify the duplicate email or mobile
field.

### Test 6 --- Role Hierarchy Violation

-   **Method:** `POST`
-   **URL:** `http://localhost:3000/api/users`
-   **Headers:** `Content-Type: application/json`, `x-user-id: 2`
-   **Expected status:** `403 Forbidden`

Example request body:

``` json
{
  "name": "Bob Retailer",
  "email": "bob.retailer@example.com",
  "mobile": "9876543211",
  "password": "Use-A-Test-Password-Only",
  "role_id": 8
}
```

Expected behavior: a Sub Admin cannot create a Retailer if that
operation violates the configured role hierarchy. Verify the actual role
rules and test data before recording the result.

## 3. Utility Helpers Integrated

The reported Users module integration uses shared utility helpers to
reduce duplicated logic and standardize API behavior.

### `src/modules/users/user.validator.js`

-   `normalizeString()` --- normalizes text input.
-   `normalizeEmail()` --- normalizes and lowercases email addresses.
-   `normalizeMobile()` --- cleans mobile-number input.
-   `isValidEmail()` --- validates email format.
-   `isValidMobile()` --- validates mobile-number format.
-   `ApiError` and `httpStatus` --- produce structured validation
    errors.

### `src/modules/users/user.service.js`

-   Validates the active creator and company.
-   Checks that the requested role exists.
-   Enforces the configured role hierarchy.
-   Detects duplicate email/mobile values.
-   Uses structured `ApiError` errors and HTTP status constants.

### `src/modules/users/user.controller.js`

-   Uses `asyncHandler` to forward asynchronous errors to Express error
    middleware.
-   Uses `ApiResponse` for consistent success responses.
-   Uses `httpStatus` constants for response codes.

## 4. Automated Tests

The reported automated test run completed with **8 passed and 0
failed**.

Reported coverage:

-   Validation rejects missing fields with `400 VALIDATION_ERROR`.
-   Validation rejects invalid email and short password.
-   Valid inputs are normalized.
-   The service requires an authenticated actor ID.
-   Password hashing generates a valid bcrypt hash.
-   Role hierarchy enforcement is tested.
-   Duplicate-user detection checks email or mobile.
-   User insertion uses approved schema columns.

Run the tests again before committing:

``` bash
npm test
```

Record the actual output and investigate any failures before proceeding.

## 5. Local Database Setup

The local development database was described as `fintech_kyc`, using
MySQL on port `3307` in the current setup. Confirm your own `.env` and
MySQL configuration rather than copying credentials from chat or another
machine.

The setup script `database/init_db.js` was described as creating/seeding
the local database schema, roles, company, role hierarchy, and a
development Admin user.

If the project requires initialization, inspect the script first and
then run it only against your intended **local development/test
database**:

``` bash
node database/init_db.js
```

> **Caution:** Do not run a setup or seed script against production.
> Check whether the script resets or overwrites data before running it.

## 6. Pre-Push Checklist

Complete each applicable item and record the outcome.

-   [ ] Every endpoint in this API feature has been tested in Postman.
-   [ ] Failures are fixed or clearly documented.
-   [ ] Valid request and validation-error behavior verified.
-   [ ] Invalid ID / not-found behavior tested if applicable.
-   [ ] Duplicate/conflicting data behavior tested if applicable.
-   [ ] Missing/invalid authentication tested for protected routes.
-   [ ] Unauthorized role and cross-user access tested if applicable.
-   [ ] Database insert/update/delete results verified as applicable.
-   [ ] Error responses are understandable and do not expose secrets.
-   [ ] Related existing endpoints still work.
-   [ ] `git status`, `git diff`, and staged changes reviewed.
-   [ ] No `.env` files, passwords, tokens, credentials, or private KYC
    data are staged.
-   [ ] Relevant automated tests pass.
-   [ ] API contract or Postman collection updated if needed.
-   [ ] Changes committed with a clear message.
-   [ ] Changes pushed to the feature branch, not directly to the
    shared/main branch.

## 7. Git Commands

Check the current branch and working tree:

``` bash
git branch --show-current
git status
git diff
git diff --cached
```

After staging only the intended files, inspect them again:

``` bash
git add <intended-files>
git diff --cached
```

Commit and push from your feature branch:

``` bash
git commit -m "feat(users): integrate utility helpers and validate user APIs"
git push -u origin HEAD
```

Replace `<intended-files>` with the files actually changed. Do not stage
`.env` or other secrets. Confirm that the push succeeds and that you are
not pushing directly to `main`.

## 8. Final Result

Fill this section after completing the checks.

  Field                      Record
  -------------------------- ----------------------------------------------------------------------
  Overall status             Ready to push
  Commit message             feat(users): integrate utility helpers and validate user APIs
  Feature branch             feature/user-creation-api     
  Postman results recorded   Yes
  Automated tests passed     Yes
  Push confirmed             Yes


## Security Notes

-   `x-user-id` is useful as a local test header only if the application
    is explicitly designed to accept it. It is not a substitute for
    verified authentication in production.
-   In production, derive the acting user's identity from a verified
    session or token and enforce authorization on the server.
-   Never commit `.env` files, database credentials, tokens, plaintext
    passwords, or private KYC data.
-   Use unique test identities and a non-production database for test
    runs.
