# AquaPay Basic Details KYC API — Root Cause Investigation Report

## Executive Summary

An investigation was conducted on the AquaPay fintech KYC backend to identify why the Basic Details KYC API fails and returns unexpected responses when a user initiates the KYC process.

Using live endpoint requests against the active backend server (`http://localhost:3000`), database schema inspection against Oracle MySQL, and code tracing through Express middlewares, controllers, services, models, and Redis OTP handlers, the root causes were isolated.

The primary failure preventing any user from starting or completing KYC Basic Details is a **critical database schema mismatch**:
1. The codebase was refactored to query `kyc_cases.steps_completed` and filter by `kyc_cases.status = 'pending'`, but the live MySQL database (`fintech_kyc.kyc_cases`) retains the legacy schema with `current_step` instead of `steps_completed` and `status ENUM('draft', ...)` without `'pending'`.
2. Every database query in `basicDetails.model.js` and `status.model.js` immediately crashes with MySQL error `ER_BAD_FIELD_ERROR: Unknown column 'steps_completed' in 'field list'` (errno: 1054).
3. The service layer catches this database error and masks it behind `503 SERVICE_UNAVAILABLE`, giving the appearance of a transient server failure.
4. In addition, the live environment lacks `REDIS_URL` and `KYC_OTP_SECRET` in `.env`, and Redis is not running on port 6379, which causes subsequent OTP requests to fail with configuration/connection errors.

---

## 1. Exact Endpoint and Request Used to Reproduce the Problem

### Request 1: Save Basic Details
- **Endpoint**: `PUT /api/kyc/basic-details`
- **Headers**:
  ```http
  Authorization: Bearer <valid_jwt_token_for_user_1>
  Content-Type: application/json
  ```
- **Payload**:
  ```json
  {
    "businessType": "Retail",
    "shopAddress": "123 Main St",
    "city": "Mumbai",
    "pincode": "400001"
  }
  ```

### Request 2: Check KYC Status
- **Endpoint**: `GET /api/kyc/status`
- **Headers**:
  ```http
  Authorization: Bearer <valid_jwt_token_for_user_1>
  ```

### Request 3: Request Step 1 OTP
- **Endpoint**: `POST /api/kyc/basic-details/request-otp`
- **Headers**:
  ```http
  Authorization: Bearer <valid_jwt_token_for_user_1>
  Content-Type: application/json
  ```
- **Payload**: `{}`

---

## 2. Actual Response and Observed Behavior

### For `PUT /api/kyc/basic-details`:
- **HTTP Status Code**: `503 Service Unavailable`
- **Response Headers**: `Content-Type: application/json; charset=utf-8`
- **Response Body**:
  ```json
  {
    "success": false,
    "message": "Service temporarily unavailable",
    "code": "SERVICE_UNAVAILABLE"
  }
  ```
- **Execution Time**: ~41 ms
- **Observed Behavior**: The request does not hang or timeout; it immediately terminates with a sanitized 503 error. The database transaction is rolled back, and no data is saved.

### For `GET /api/kyc/status`:
- **HTTP Status Code**: `503 Service Unavailable`
- **Response Body**:
  ```json
  {
    "success": false,
    "message": "Service temporarily unavailable",
    "code": "SERVICE_UNAVAILABLE"
  }
  ```
- **Execution Time**: ~179 ms
- **Observed Behavior**: Fails immediately with 503 because the SQL projection queries `k.steps_completed`.

---

## 3. Complete Request Lifecycle Trace

The execution was traced across all 12 architectural layers for `PUT /api/kyc/basic-details`:

| Layer | Component & File | Input Received | Function Called | Output Produced | Error / Status | Next Layer Reached? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Express App (`src/app.js`) | HTTP PUT Request, headers, JSON body | `app.handle` | Dispatched to `/api/kyc` router | None | Yes |
| **2** | KYC Route Mounting (`src/modules/kyc/kyc.routes.js`) | Express `req`, `res`, `next` | `router.use(basicDetailsRoutes)` | Sub-router matched | None | Yes |
| **3** | Basic Details Routes (`src/modules/kyc/basic-details/basicDetails.routes.js`) | Path: `/basic-details` | Route stack execution | Dispatched to middleware chain | None | Yes |
| **4** | Auth Middleware (`src/middlewares/auth.middleware.js`) | `Authorization: Bearer <token>` | `requireAuth(req, res, next)` | `req.user = { id: '1' }` (active user verified) | None | Yes |
| **5** | Validator Middleware (`src/modules/kyc/basic-details/basicDetails.validator.js`) | `req.body` with 4 fields | `validateBasicDetails(req, res, next)` | `req.validatedBody` populated | None | Yes |
| **6** | Controller (`src/modules/kyc/basic-details/basicDetails.controller.js`) | `req.user.id`, `req.validatedBody` | `saveBasicDetails(req, res)` via `asyncHandler` | Invokes `basicDetailsService.saveBasicDetails` | None | Yes |
| **7** | Service (`src/modules/kyc/basic-details/basicDetails.service.js`) | `userId = '1'`, validated details | `saveBasicDetails(userId, fields)` | Acquires connection, begins transaction | Throws `serviceUnavailable()` | Control passes to catch block |
| **8** | Model (`src/modules/kyc/basic-details/basicDetails.model.js`) | `connection`, `userId = '1'` | `findCasesByUserIdForUpdate(connection, 1)` | Executes SQL | **CRASH: ER_BAD_FIELD_ERROR 1054** | **NO — Aborts at Model Layer** |
| **9** | MySQL Transaction Handling (`src/config/db.js`) | `connection` | `connection.rollback()`, `connection.release()` | Transaction rolled back | None | Control returns to Service catch |
| **10** | Redis OTP Store (`src/modules/kyc/basic-details/kycOtpStore.js`) | N/A | Not called (blocked before challenge invalidation) | None | N/A | No |
| **11** | Central Error Middleware (`src/middlewares/error.middleware.js`) | `ApiError(503, "KYC service is temporarily unavailable", "SERVICE_UNAVAILABLE")` | `errorHandler(err, req, res, next)` | Formats sanitized 503 JSON | `503 SERVICE_UNAVAILABLE` | Yes |
| **12** | HTTP Response Generation | `res.status(503).json(...)` | Express `res.send` | Client receives HTTP 503 | Handled | Completed |

---

## 4. Last Successful and First Blocked Execution Points

- **Last Successful Execution Point**:
  [basicDetails.model.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.model.js#L7-L17):
  ```javascript
  const user = await basicDetailsModel.findActiveUserForUpdate(connection, userId);
  ```
  Query `SELECT id, address, city, pincode, status FROM users WHERE id = 1 LIMIT 1 FOR UPDATE` executes successfully and returns `{ id: 1, address: null, city: null, pincode: null, status: 'active' }`.

- **First Failing / Blocked Execution Point**:
  [basicDetails.model.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.model.js#L19-L30):
  ```javascript
  const cases = await basicDetailsModel.findCasesByUserIdForUpdate(connection, userId);
  ```
  Query:
  ```sql
  SELECT id, user_id, business_type, status, steps_completed
    FROM kyc_cases
   WHERE user_id = 1
   ORDER BY id ASC
   LIMIT 2
   FOR UPDATE
  ```
  **Fails with**:
  ```
  code: 'ER_BAD_FIELD_ERROR'
  errno: 1054
  sqlState: '42S22'
  sqlMessage: "Unknown column 'steps_completed' in 'field list'"
  ```

---

## 5. Relevant MySQL and Redis Findings

### 5.1 MySQL Live Schema Inspection vs Code Expectations

Direct inspection of `DESCRIBE kyc_cases` in the live `fintech_kyc` MySQL database revealed:

```sql
+------------------+--------------------------------------------------------------------+------+-----+-------------------+
| Field            | Type                                                               | Null | Key | Default           |
+------------------+--------------------------------------------------------------------+------+-----+-------------------+
| id               | bigint unsigned                                                    | NO   | PRI | NULL              |
| user_id          | bigint unsigned                                                    | NO   | MUL | NULL              |
| business_type    | varchar(100)                                                       | YES  |     | NULL              |
| shop_address     | varchar(255)                                                       | YES  |     | NULL              |
| city             | varchar(100)                                                       | YES  |     | NULL              |
| pincode          | varchar(10)                                                        | YES  |     | NULL              |
| status           | enum('draft','submitted','under_review','approved','rejected')     | NO   | MUL | draft             |
| current_step     | tinyint unsigned                                                   | NO   |     | 1                 |
| submitted_at     | datetime                                                           | YES  |     | NULL              |
| reviewed_at      | datetime                                                           | YES  |     | NULL              |
| rejection_reason | varchar(500)                                                       | YES  |     | NULL              |
| created_at       | timestamp                                                          | NO   |     | CURRENT_TIMESTAMP |
| updated_at       | timestamp                                                          | NO   |     | CURRENT_TIMESTAMP |
+------------------+--------------------------------------------------------------------+------+-----+-------------------+
```

#### The Migration Desynchronization:
1. `schema_migrations` in MySQL contains 4 recorded migrations:
   - `001_initial_schema.sql` (applied 2026-10-23)
   - `002_auth_security_tables.sql` (applied 2026-10-23)
   - `003_kyc_tables.sql` (applied 2026-10-23)
   - `004_add_address_to_kyc_cases.sql` (applied 2026-10-23)
2. On 2026-10-24, git commit `9479ce0` altered `003_kyc_tables.sql` in place to change `current_step` to `steps_completed` and `'draft'` to `'pending'`.
3. However, because `003_kyc_tables.sql` was already recorded in `schema_migrations`, `database/migrate.js` skipped it. The live database was never migrated to the new schema.
4. As a result, the live database:
   - Has column `current_step`, NOT `steps_completed`.
   - Has ENUM `('draft','submitted','under_review','approved','rejected')`, NOT `('pending',...)`.
   - Has `shop_address`, `city`, `pincode` in `kyc_cases` (added by the deleted 004 migration), while `basicDetails.model.js` writes address to the `users` table.

### 5.2 Redis Dependencies and Connection Status
1. **Missing Configuration**: `.env` currently contains no `REDIS_URL` and no `KYC_OTP_SECRET`.
2. **Missing Process**: Verification of TCP listeners confirms port `6379` is not listening.
3. **Lazy Connection**: `src/config/redis.js` does not connect on server startup. When `requestStep1Otp` or `verifyStep1Otp` is triggered:
   - `getKycOtpSecret()` throws `Error: KYC_OTP_SECRET is not configured securely`.
   - `createRedisClient()` throws `Error: REDIS_URL is not configured`.
   - `basicDetailsService` converts both to `503 SERVICE_UNAVAILABLE`.

---

## 6. Confirmed Defects

### Defect 1: Live MySQL Schema Desynchronization (`steps_completed` and `status` ENUM)
- **File Path**: [basicDetails.model.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.model.js) and [status.model.js](file:///d:/aquaPay/src/modules/kyc/status/status.model.js)
- **Function Name**: `findCasesByUserIdForUpdate`, `updateCaseBasicDetails`, `updateCompletedStepsCount`, `findStepCompletionState`, `findCasesByUserId`
- **Existing Behavior**: Queries select/update `steps_completed` and assume `status` includes `'pending'`.
- **Expected Behavior**: Database columns and values must align with the codebase queries.
- **Actual Behavior**: Queries fail with `ER_BAD_FIELD_ERROR: Unknown column 'steps_completed' in 'field list'` (errno: 1054). Insert of `'pending'` fails with `WARN_DATA_TRUNCATED` (errno: 1265).
- **Reproduction Evidence**:
  ```javascript
  const cases = await basicDetailsModel.findCasesByUserIdForUpdate(conn, 1);
  // Throws: Unknown column 'steps_completed' in 'field list' Code: ER_BAD_FIELD_ERROR
  ```
- **Impact**: 100% failure rate (HTTP 503) across all KYC endpoints (`saveBasicDetails`, `requestStep1Otp`, `verifyStep1Otp`, `getKycStatus`).
- **Proposed Correction**: Provide a forward migration (`database/migrations/004_sync_kyc_cases_schema.sql` or alignment script) that safely renames/replaces `current_step` with `steps_completed TINYINT UNSIGNED NOT NULL DEFAULT 0` and alters the `status` ENUM to include `'pending'`.

---

### Defect 2: Missing Required Pincode Validation in `validateBasicDetails`
- **File Path**: [basicDetails.validator.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.validator.js#L52-L54)
- **Function Name**: `validateBasicDetails`
- **Existing Behavior**:
  ```javascript
  if (!isValidPincode(pincode)) {
    errors.push("Pincode must be a valid 6-digit postal code");
  }
  ```
- **Expected Behavior**: Pincode must be required for Step 1 Basic Details.
- **Actual Behavior**: `isValidPincode("")` returns `true` because it was written for optional user updates in `validationHelper.js`. If a client sends an empty string or omits `pincode`, validation passes without error. However, `getSavedBasicDetails` in `basicDetails.service.js` checks `!details.pincode` and throws `400 BASIC_DETAILS_REQUIRED` when requesting OTP.
- **Reproduction Evidence**:
  Calling `validateBasicDetails` with `{ businessType: "Retail", shopAddress: "123 Main", city: "Pune", pincode: "" }` yields `req.validatedBody.pincode = ""` with zero validation errors.
- **Impact**: Incomplete records can be saved, causing subsequent OTP request to fail unexpectedly.
- **Proposed Correction**: Explicitly check presence before format:
  ```javascript
  if (!pincode) {
    errors.push("Pincode is required");
  } else if (!isValidPincode(pincode)) {
    errors.push("Pincode must be a valid 6-digit postal code");
  }
  ```

---

### Defect 3: Unsafe Connection Rollback in `saveBasicDetails`
- **File Path**: [basicDetails.service.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.service.js#L512-L519)
- **Function Name**: `saveBasicDetails`
- **Existing Behavior**:
  ```javascript
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error instanceof ApiError) throw error;
    logDevelopmentFailure("Basic Details save", error);
    throw serviceUnavailable();
  } finally {
    connection.release();
  }
  ```
- **Expected Behavior**: If rollback fails due to a network or connection issue, the connection must be destroyed via `connection.destroy()` so that a poisoned connection in an active transaction state is never released back to the pool.
- **Actual Behavior**: `saveBasicDetails` releases the connection regardless of whether rollback succeeded, unlike `requestStep1Otp` and `verifyStep1Otp` which use the safe `releaseConnection(connection, rollback)` helper.
- **Reproduction Evidence**: Code inspection of lines 211–226 vs lines 512–519.
- **Impact**: Connection pool pollution risk on transient database network errors.
- **Proposed Correction**: Replace manual rollback/release in `saveBasicDetails` with `releaseConnection(connection, true)`.

---

## 7. Confirmed Response-Handling Defects

### Defect 4: Overly Strict Empty Body Requirement on `request-otp`
- **File Path**: [basicDetails.validator.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.validator.js#L71-L94)
- **Function Name**: `validateKycOtpRequest`
- **Existing Behavior**: Rejects any request where `req.body` is not an object or `Object.keys(body).length > 0`.
- **Actual Behavior**: If a client sends a standard `POST /api/kyc/basic-details/request-otp` without a body or without `Content-Type: application/json`, Express sets `req.body = undefined`, triggering `400 Request body must be a valid JSON object`.
- **Expected Behavior**: A POST trigger endpoint should accept empty body, undefined body, or `{}`.
- **Proposed Correction**: Normalize body: `const body = req.body || {};` before checking keys.

### Defect 5: Generic Error Masking of Internal Database Failures
- **File Path**: [basicDetails.service.js](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.service.js#L11-L18) and [status.service.js](file:///d:/aquaPay/src/modules/kyc/status/status.service.js#L5-L12)
- **Function Name**: `serviceUnavailable`
- **Existing Behavior**: Catches all database errors and maps them to `503 SERVICE_UNAVAILABLE`.
- **Actual Behavior**: In development, `logDevelopmentFailure` only logs sanitized error codes if `process.env.NODE_ENV === "development"`. In production, all SQL syntax and schema errors are completely silent, returning only `{ "message": "Service temporarily unavailable" }`.
- **Impact**: Diagnosing schema bugs in staging or deployment environments is obstructed.

---

## 8. Potential Defects Requiring Further Reproduction

1. **Lack of Unique Constraint on `kyc_cases.user_id`**:
   The table `kyc_cases` does not have a `UNIQUE(user_id)` constraint. If user creation or case creation is triggered concurrently, duplicate cases could be inserted. Once multiple cases exist, `findCasesByUserIdForUpdate` detects `cases.length > 1` and permanently blocks the user with `409 KYC_CASE_AMBIGUOUS`.
2. **Re-editing Basic Details After Step 1 Completion**:
   In `saveBasicDetails`, calling `PUT /api/kyc/basic-details` on an already completed Step 1 resets the step to `in_progress` and decrements `steps_completed`. However, `requestStep1Otp` and `verifyStep1Otp` throw `409 STEP_ALREADY_COMPLETED`. Business clarification is required on whether completed basic details should be locked against edits or allowed to reset.
3. **Address Field Duality (`shopAddress` vs `address`)**:
   `users` table stores merchant address as `address`. The Basic Details payload expects `shopAddress`. Meanwhile, `state` and `shopname` are stored in `users`, but are rejected as unexpected fields in `validateBasicDetails`.

---

## 9. Root Cause Summary with Code References

The failure of the Basic Details KYC API is caused by:

1. **Schema Mismatch**:
   - Query in [`basicDetails.model.js#L21`](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.model.js#L21) selects `steps_completed` from `kyc_cases`.
   - Query in [`status.model.js#L5`](file:///d:/aquaPay/src/modules/kyc/status/status.model.js#L5) selects `steps_completed` from `kyc_cases`.
   - Query in [`user.model.js#L220`](file:///d:/aquaPay/src/modules/users/user.model.js#L220) inserts `'pending'` and `steps_completed` into `kyc_cases`.
   - The live database table `kyc_cases` contains `current_step` (not `steps_completed`) and ENUM `('draft','submitted',...)` (not `'pending'`).
   - Every read/write operation fails with MySQL error code `1054` or `1265`.
2. **Missing Infrastructure Configuration**:
   - `.env` lacks `REDIS_URL` and `KYC_OTP_SECRET`.
   - No Redis daemon is active on `127.0.0.1:6379`.
   - Line 243 in [`basicDetails.service.js#L243`](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.service.js#L243) hardcodes `if (process.env.NODE_ENV !== "development") throw serviceUnavailable()`.
3. **Pincode Validation Hole**:
   - Line 52 in [`basicDetails.validator.js#L52`](file:///d:/aquaPay/src/modules/kyc/basic-details/basicDetails.validator.js#L52) fails to require `pincode`, allowing empty values to pass and subsequently crash OTP generation.

---

## 10. Recommended Targeted Fixes

1. **Database Schema Synchronization**:
   - Execute a forward migration script to bring the live `kyc_cases` table into sync with the model:
     - Rename column `current_step` to `steps_completed TINYINT UNSIGNED NOT NULL DEFAULT 0`.
     - Alter column `status` to `ENUM('pending','submitted','under_review','approved','rejected') NOT NULL DEFAULT 'pending'`.
     - Update `schema_migrations` tracking.
2. **Validator Hardening**:
   - In `basicDetails.validator.js`, check `if (!pincode)` and return `"Pincode is required"`.
   - In `validateKycOtpRequest`, permit undefined/empty request bodies.
3. **Connection Safety in `saveBasicDetails`**:
   - Refactor `saveBasicDetails` in `basicDetails.service.js` to use `releaseConnection(connection, true)` inside the error handler.
4. **Environment and Redis Verification**:
   - Add `REDIS_URL` and `KYC_OTP_SECRET` to `.env`.
   - Add startup readiness checks in `src/server.js` to ensure Redis and KYC secrets are verified at boot time.

---

## 11. Required Regression Tests

Once targeted fixes are approved, the following tests must be executed:
1. `PUT /api/kyc/basic-details` with valid payload returns HTTP 200 and persists `business_type` in `kyc_cases` and `address`, `city`, `pincode` in `users`.
2. `PUT /api/kyc/basic-details` with missing or empty `pincode` returns HTTP 400 `VALIDATION_ERROR`.
3. `GET /api/kyc/status` returns HTTP 200 with `steps_completed: 0` and `status: 'pending'`.
4. `POST /api/kyc/basic-details/request-otp` with empty body `{}` generates OTP, stores HMAC challenge in Redis, and enforces 60s cooldown.
5. `POST /api/kyc/basic-details/verify-otp` with valid OTP transitions Step 1 to `completed` and updates `steps_completed: 1`.
6. Existing 108 unit tests in `npm test` continue to pass without modifications or omissions.

---

*This report concludes the investigation for Phase 1 and Root Cause Analysis. Implementation of targeted fixes will commence upon user approval.*
