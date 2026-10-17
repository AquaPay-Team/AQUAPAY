# AquaPay Codebase Changes Summary

This document provides a comprehensive summary of all architectural changes, schema synchronizations, validation rules, bug fixes, and security policies implemented across the AquaPay codebase.

---

## 1. Database Schema & Migration Synchronization

### Root Cause & Problem Resolved
Earlier in development, the users table was created with legacy column names `full_name VARCHAR(120) NOT NULL` (with no default value) and `parent_user_id BIGINT UNSIGNED NULL`. When the application codebase was updated to use `name` and `parent_id`, the SQL insert statements only targeted `name`. Because MySQL was running in strict mode (`STRICT_TRANS_TABLES`), user creation crashed with:
```
Error: Field 'full_name' doesn't have a default value (code: ER_NO_DEFAULT_FOR_FIELD, errno: 1364)
```

### Changes Applied:
1. **Live MySQL Table Cleanup**:
   - Dropped obsolete legacy columns `full_name` and `parent_user_id` from `fintech_kyc.users`:
     ```sql
     ALTER TABLE users DROP COLUMN full_name, DROP COLUMN parent_user_id;
     ```
2. **Migration Synchronization ([`database/migrations/001_initial_schema.sql`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/database/migrations/001_initial_schema.sql))**:
   - Standardized `name VARCHAR(120) NOT NULL` (replaces `full_name`).
   - Standardized `parent_id BIGINT UNSIGNED NULL` with foreign key `fk_users_parent` (replaces `parent_user_id`).
   - Allowed `state VARCHAR(100) NULL` and `city VARCHAR(100) NULL` for flexible onboarding and root Admin bootstrap.
   - Set `status` default to `'active'`.
   - Preserved `created_by` for technical audit logging while `parent_id` tracks the business hierarchy parent.
3. **Admin Service Alignment ([`src/modules/admin/admin.service.js`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/src/modules/admin/admin.service.js))**:
   - Aligned insert statement to target `(name, email, mobile, company_id, role_id, parent_id, password_hash, status)`.

---

## 2. Input Validation Overhaul

### Implemented in [`src/modules/users/user.validator.js`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/src/modules/users/user.validator.js) and [`src/utils/validationHelper.js`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/src/utils/validationHelper.js):

1. **`name` Validation**:
   - **Type Check**: Must be a string (rejects numbers, booleans, objects, arrays).
   - **Character Check**: Strictly letters and spaces only (`/^[a-zA-Z\s]+$/`).
   - **Length Check**: 2 to 100 characters.
   - **Sanitization**: Auto-trims leading/trailing whitespace.
   - Applied to both User Creation (`POST /api/users`) and User Update (`PUT /api/users/:id`).
2. **`mobile` Auto-Prefix & Validation**:
   - Indian mobile format validation: 10 digits starting with `6-9`.
   - Normalization: Auto-prefixes raw 10 digits with `+91` (e.g. `9811223344` -> `+919811223344`).
3. **`email` Validation**:
   - Strictly conforms to RFC standard with max 254 characters.
4. **`password` Validation**:
   - Min 8 characters, max 128 characters, hashed with `bcrypt` (10 rounds for users, 12 rounds for admin).
5. **Standardized Error Format**:
   - Returns HTTP `400 Bad Request` with structured payload:
     ```json
     {
       "statusCode": 400,
       "success": false,
       "message": "Name must contain only letters and spaces",
       "errors": ["Name must contain only letters and spaces"],
       "code": "VALIDATION_ERROR"
     }
     ```

---

## 3. Role Hierarchy & Downline Branch Isolation

### Implemented in [`src/modules/users/user.service.js`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/src/modules/users/user.service.js) and [`src/modules/users/user.model.js`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/src/modules/users/user.model.js):

1. **Strict Downline Creation Rule (`child.level > parent.level`)**:
   - **Admin (Level 0 / 1)**: Can create any subordinate role (Sub Admin down to Retailer). Cannot create another Admin.
   - **Sub Admin (Level 1 / 2)**: Can create any subordinate role (NSM down to Retailer). Cannot create Admin or Sub Admin.
   - **NSM (Level 2 / 3)**: Can create SH, CHF, MD, DT, RT.
   - **SH, CHF, MD, DT**: Can only create roles strictly deeper in their chain.
   - **Retailer (Level 7 / 8)**: Leaf node; cannot create child accounts.
2. **Recursive Common Table Expression (CTE) Downline Isolation**:
   - Implemented `WITH RECURSIVE downline AS (...)` in MySQL for queries.
   - **Admin**: Has global visibility and control across the entire organization.
   - **Subordinate Managers (Sub Admin, NSM, SH, etc.)**: Strictly isolated to their own downline tree. Sub Admin A cannot see, query, modify, or delete accounts created by Sub Admin B.
3. **Self-Protection Guardrails**:
   - Users cannot modify their own account status (`400 Bad Request`).
   - Users cannot delete their own account (`400 Bad Request`).

---

## 4. Authentication & Controller Enhancements

### Implemented in [`src/modules/users/user.controller.js`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/src/modules/users/user.controller.js):

1. **Actor ID Header Extraction**:
   - Extracts caller identity from `req.user.id` or headers (`x-user-id` / `user-id`).
   - If missing, immediately returns `401 Unauthorized`:
     ```json
     {
       "success": false,
       "message": "Authentication required",
       "code": "UNAUTHORIZED"
     }
     ```
2. **Safe Response Projection**:
   - Password hashes are completely excluded from all API responses.
   - Response bodies include enriched hierarchy info (`role_name`, `role_level`, `parent_name`, `company_name`).

---

## 5. Git & Project Cleanliness ([`.gitignore`](file:///C:/Users/Kumar/OneDrive/Desktop/aquapay/AQUAPAY/.gitignore))

1. **Sensitive Files & Secrets**:
   - `.env`, `.env.*` (while preserving `.env.example` as a template).
   - Certificates and keys (`*.pem`, `*.key`, `*.cert`).
2. **Unnecessary Push Files**:
   - `tests/` directory, `apiEndpoints.test.js`, and `userCreation.test.js` excluded from git push.
   - Staged postman collection `AquaPay.postman_collection.json` untracked from the git index while preserved safely on disk.
   - Postman local environment dumps (`*.postman_environment.json`).
3. **Development & OS Artifacts**:
   - `node_modules/`, log files (`*.log`), debug dumps, IDE folders (`.vscode/`, `.idea/`), and OS files (`Thumbs.db`, `.DS_Store`).

---

## 6. Verification & Automated Test Suite

- **Total Automated Tests**: 31 unit and integration tests passing (`node --test tests/**/*.test.js`).
- **Covered Scenarios**:
  - Health check & 404 route handling.
  - Admin bootstrap with setup key validation and field constraints.
  - User creation validation (string check, alphabetic check, 100-character boundary, password length, mobile formatting, RFC email).
  - Role hierarchy validation and enforcement.
  - Branch isolation tests (Sub Admin & NSM seeing only their descendants).
  - Downline queries, single user retrieval, status updates, and deletions.
