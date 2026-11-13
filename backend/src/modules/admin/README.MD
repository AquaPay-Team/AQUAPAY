# AQUAPAY — Admin Module

## 1. Purpose

The Admin module handles initial Admin account creation for the AQUAPAY fintech KYC backend using Node.js, Express, and MySQL.

## 2. Folder Structure

```text
admin/
├── admin.controller.js
├── admin.service.js
├── admin.routes.js
├── adminSetup.middleware.js
└── README.md
```

## 3. Files and Responsibilities

| File | Responsibility |
|---|---|
| `admin.controller.js` | Validates input and handles HTTP responses. |
| `admin.service.js` | Implements Admin creation and database operations. |
| `admin.routes.js` | Defines the endpoint and middleware sequence. |
| `adminSetup.middleware.js` | Verifies the Admin setup key. |
| `README.md` | Documents functionality, testing, and remaining work. |

## 4. API Endpoint

- **Method:** `POST`
- **Endpoint:** `/api/admin/create`
- **Local URL:** `http://localhost:3000/api/admin/create`

### Request Body

```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "mobile": "9876543210",
  "companyName": "AQUAPAY",
  "password": "your-strong-password"
}
```

The request requires the `x-admin-setup-key` header. The backend assigns the Admin role; the client does not choose the role ID.

## 5. Request Flow

1. `verifyAdminSetupKey` checks the setup key.
2. `validateAdminInput` validates the request body.
3. `createAdminController` handles the request.
4. `createAdmin` executes the business logic.
5. MySQL stores the company and Admin account within a transaction.
6. The controller returns the API response.

## 6. Implemented Functionality

- Required-field, email, mobile-number, and name-length validation.
- Minimum password length of eight characters.
- Setup-key protection through an HTTP request header.
- Company lookup and creation when required.
- Password hashing with bcrypt.
- Admin creation with `role_id = 1` and `parent_id = NULL`.
- Transaction handling with commit and rollback.
- Duplicate Admin prevention.
- Admin response excludes the stored password hash.

## 7. Environment Configuration

- The root `.env` contains actual configuration, including `ADMIN_SETUP_KEY`.
- The root `.env.example` documents required variables using placeholders.
- Never commit `.env` files or expose secrets.

## 8. Testing Results

Tests were performed locally using Postman and MySQL Workbench.

| Test | Result |
|---|---|
| Health endpoint | Passed — `200 OK` |
| Valid Admin creation | Passed — Admin created successfully |
| Missing setup key | Passed — request rejected |
| Incorrect setup key | Passed — request rejected |
| Missing required fields | Passed — validation error returned |
| Invalid email | Passed — validation error returned |
| Invalid mobile number | Passed — validation error returned |
| Password shorter than 8 characters | Passed — validation error returned |
| Empty name or company name | Passed — validation error returned |
| Name over 100 characters | Passed — validation error returned |
| Company name over 150 characters | Passed — validation error returned |
| Duplicate Admin creation | Partially passed — service rejects the second Admin with `409 Conflict`, but the API response incorrectly says `Internal server error` |
| Database record and relationships | Verified — Admin, company, and role records match |
| Password storage | Verified format — stored value has a bcrypt-compatible prefix |

## 9. Remaining Work

- Verify HTTP status codes for all validation tests.
- Test password verification and validation boundary cases.
- Review transaction concurrency and database constraints.
- Add rate limiting for repeated setup-key attempts.
- Review security, audit logging, and error handling before deployment.
- Complete regression testing before pushing changes.

## 10. Current Status

The initial Admin creation flow is implemented and has passed the main functional and validation tests listed above. Duplicate-Admin protection works, but its API error response needs correction. Remaining checks must be completed before marking the module ready to push.

**Testing and further updates will be documented as development continues.**