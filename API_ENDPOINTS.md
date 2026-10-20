# AquaPay Backend API — Complete Endpoints Reference

Comprehensive documentation for all active endpoints available in the AquaPay fintech backend platform.

---

## 1. Quick Reference Table

| Module | Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Health** | `GET` | `/api/health` | None (Public) | Check server health and liveness |
| **Admin** | `POST` | `/api/admin/create` | `x-admin-setup-key` | One-time bootstrap of root Admin and Company |
| **Auth** | `POST` | `/api/auth/login` | None (Public, Rate-Limited) | Authenticate via email/mobile and receive JWT |
| **Auth** | `GET` | `/api/auth/me` | Bearer JWT | Retrieve currently authenticated user profile |
| **Auth** | `POST` | `/api/auth/forgot-password` | None (Public, Rate-Limited) | Initiate password recovery request |
| **Auth** | `POST` | `/api/auth/reset-password` | None (Public, Rate-Limited) | Reset account password using recovery token |
| **Users** | `POST` | `/api/users` | Bearer JWT or `x-user-id` | Create a subordinate child user down in hierarchy |

---

## 2. Global Conventions

### 2.1 Base URL & Environment
* **Default Local URL**: `http://localhost:3000`
* **JSON Payloads**: Max payload size limit is `16kb`.
* **Headers**: All `POST` and `PUT` endpoints expect `Content-Type: application/json`.

### 2.2 Standard Success Envelope
All successful responses follow this format:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### 2.3 Standard Error Envelope
All error responses return structured JSON:
```json
{
  "success": false,
  "message": "Error description message",
  "code": "ERROR_CODE",
  "errors": ["Specific validation error item"]
}
```

Common status codes:
* `200 OK`: Request succeeded.
* `201 Created`: Resource successfully created.
* `400 Bad Request`: Input validation failed or malformed JSON (`VALIDATION_ERROR` / `INVALID_RESET_TOKEN`).
* `401 Unauthorized`: Missing or invalid authentication token / key (`UNAUTHORIZED` / `INVALID_CREDENTIALS`).
* `403 Forbidden`: Authenticated user lacks permission (`FORBIDDEN`).
* `404 Not Found`: Target route or entity not found (`ROUTE_NOT_FOUND`).
* `409 Conflict`: Unique constraint violation (`DUPLICATE_ENTRY`).
* `429 Too Many Requests`: Rate limit threshold exceeded (`RATE_LIMITED`).
* `500 Internal Server Error`: Server failure.

---

## 3. Role Hierarchy Reference

The system enforces a strict role hierarchy for user creation via the `role_hierarchy` table:

| Role ID | Role Name | Slug | Creation Rights |
| :---: | :--- | :---: | :--- |
| **1** | Admin | `AD` | Root System Owner; can create Sub Admin, NSM, SH, CNF, MD, DT, RT |
| **2** | Sub Admin | `SA` | Can create NSM, SH, CNF, MD, DT, RT |
| **3** | NSM | `NSM` | National State Manager; can create SH, CNF, MD, DT, RT |
| **4** | SH | `SH` | State Head; can create CNF, MD, DT, RT |
| **5** | CNF | `CNF` | C&F Agent; can create Master Distributor, Distributor, Retailer |
| **6** | Master Distributor | `MD` | Can create Distributor, Retailer |
| **7** | Distributor | `DT` | Can create Retailer |
| **8** | Retailer | `RT` | Leaf Node; cannot create child users |

---

## 4. Detailed Endpoint Specifications

---

### 4.1 Health Check API

#### `GET /api/health`
Checks whether the AquaPay server is up and responsive.

* **Authentication**: None (Public)
* **Headers**: None required

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "AquaPay is running"
}
```

#### cURL Example:
```bash
curl -X GET http://localhost:3000/api/health
```

---

### 4.2 Admin Setup API

#### `POST /api/admin/create`
One-time bootstrapping endpoint to create the root system Admin and associated Company. A singleton check prevents more than one Admin from ever being created.

* **Authentication**: Required via `x-admin-setup-key` header matching `ADMIN_SETUP_KEY` in `.env`.
* **Headers**:
  * `Content-Type: application/json`
  * `x-admin-setup-key: <ADMIN_SETUP_KEY>`

#### Request Body:
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `name` | String | Yes | 1 to 100 characters | Admin full name |
| `email` | String | Yes | Valid email format | Unique Admin email address |
| `mobile` | String | Yes | 10 digits starting with 6–9 | Indian mobile number |
| `companyName`| String | Yes | 1 to 150 characters | Company / organization name |
| `password` | String | Yes | Min 8 characters | Password (hashed using bcrypt, 12 rounds) |

#### Request Example:
```json
{
  "name": "System Admin",
  "email": "admin.primary@aquapay.com",
  "mobile": "9998887776",
  "companyName": "AquaPay Fintech Ltd",
  "password": "AdminPassword123!"
}
```

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "message": "Admin created successfully",
  "data": {
    "id": 1,
    "name": "System Admin",
    "email": "admin.primary@aquapay.com",
    "companyId": 1,
    "roleId": 1,
    "status": "active"
  }
}
```

#### Error Responses:
* **`401 Unauthorized`** — Missing or invalid setup key:
  ```json
  {
    "success": false,
    "message": "Invalid or missing setup key"
  }
  ```
* **`400 Bad Request`** — Validation error:
  ```json
  {
    "success": false,
    "message": "Password must be at least 8 characters"
  }
  ```
* **`409 Conflict`** — Admin account already exists:
  ```json
  {
    "success": false,
    "message": "An Admin account already exists"
  }
  ```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/api/admin/create \
  -H "Content-Type: application/json" \
  -H "x-admin-setup-key: aquapay_admin_setup_secret_key_2026" \
  -d '{
    "name": "System Admin",
    "email": "admin.primary@aquapay.com",
    "mobile": "9998887776",
    "companyName": "AquaPay Fintech Ltd",
    "password": "AdminPassword123!"
  }'
```

---

### 4.3 Authentication APIs

#### 4.3.1 User Login
#### `POST /api/auth/login`
Authenticates a user by email or mobile number and password, issuing a signed JSON Web Token (JWT).

* **Authentication**: None (Public)
* **Rate Limiting**: Enforced per IP and identifier window.
* **Headers**: `Content-Type: application/json`

#### Request Body:
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `identifier` | String | Yes | User email address OR mobile number (10–15 digits) |
| `password` | String | Yes | User password |

#### Request Example (Email Login):
```json
{
  "identifier": "admin.primary@aquapay.com",
  "password": "AdminPassword123!"
}
```

#### Request Example (Mobile Login):
```json
{
  "identifier": "9998887776",
  "password": "AdminPassword123!"
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "1h",
    "user": {
      "id": 1,
      "name": "System Admin",
      "email": "admin.primary@aquapay.com",
      "mobile": "9998887776",
      "role_id": 1,
      "company_id": 1,
      "parent_id": null,
      "status": "active",
      "role_name": "Admin",
      "company_name": "AquaPay Fintech Ltd"
    }
  }
}
```

#### Error Responses:
* **`401 Unauthorized`** — Invalid credentials, wrong password, or inactive/blocked status (generic message for security):
  ```json
  {
    "success": false,
    "message": "Invalid email/mobile or password",
    "code": "INVALID_CREDENTIALS"
  }
  ```
* **`429 Too Many Requests`** — Exceeded rate limit:
  ```json
  {
    "success": false,
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMITED"
  }
  ```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin.primary@aquapay.com",
    "password": "AdminPassword123!"
  }'
```

---

#### 4.3.2 Get Current User Profile
#### `GET /api/auth/me`
Fetches the safe profile of the currently authenticated active user.

* **Authentication**: Required via Bearer JWT
* **Headers**:
  * `Authorization: Bearer <accessToken>`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": 1,
    "name": "System Admin",
    "email": "admin.primary@aquapay.com",
    "mobile": "9998887776",
    "role_id": 1,
    "company_id": 1,
    "parent_id": null,
    "status": "active",
    "role_name": "Admin",
    "company_name": "AquaPay Fintech Ltd"
  }
}
```

#### Error Responses:
* **`401 Unauthorized`** — Missing, invalid, expired token, or user account inactive:
  ```json
  {
    "success": false,
    "message": "Invalid or expired access token",
    "code": "UNAUTHORIZED"
  }
  ```

#### cURL Example:
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

---

#### 4.3.3 Forgot Password
#### `POST /api/auth/forgot-password`
Initiates account password recovery. Always returns a generic success message to prevent user enumeration.

* **Authentication**: None (Public)
* **Rate Limiting**: Enforced per IP and identifier.
* **Headers**: `Content-Type: application/json`

#### Request Body:
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `identifier` | String | Yes | Account email address or mobile number |

#### Request Example:
```json
{
  "identifier": "rajesh@aquapay.com"
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "If the account exists and recovery delivery is available, instructions will be sent.",
  "data": null
}
```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"identifier": "rajesh@aquapay.com"}'
```

---

#### 4.3.4 Reset Password
#### `POST /api/auth/reset-password`
Consumes a single-use 256-bit recovery token and updates the account password.

* **Authentication**: None (Token validated transactionally)
* **Rate Limiting**: Enforced per IP and token.
* **Headers**: `Content-Type: application/json`

#### Request Body:
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `token` | String | Yes | Exact token received | 256-bit base64url random recovery token |
| `password` | String | Yes | Min 8 characters | New account password |

#### Request Example:
```json
{
  "token": "4f9d2a1b7e...",
  "password": "BrandNewSecurePassword123!"
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null
}
```

#### Error Responses:
* **`400 Bad Request`** — Token invalid, expired, or already consumed:
  ```json
  {
    "success": false,
    "message": "Invalid or expired password reset token",
    "code": "INVALID_RESET_TOKEN"
  }
  ```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "4f9d2a1b7e...",
    "password": "BrandNewSecurePassword123!"
  }'
```

---

### 4.4 User Management API

#### 4.4.1 Create User
#### `POST /api/users`
Creates a permitted child user in the caller's hierarchy. The creating user is automatically assigned as the child's `parent_id`.

* **Authentication**:
  * `Authorization: Bearer <accessToken>` (Standard JWT)
  * OR `x-user-id: <creator_id>` (Direct actor header)
* **Permission Check**: The target role must be a permitted descendant in `role_hierarchy` relative to caller's role.
* **Headers**:
  * `Content-Type: application/json`
  * `Authorization: Bearer <accessToken>` (or `x-user-id: 1`)

#### Request Body:
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `name` | String | Yes | 2–100 chars, letters & spaces only | Full name of the user |
| `email` | String | Yes | Valid email format, max 254 chars | Unique email address |
| `mobile` | String | Yes | 10 digits Indian format (`6-9...`) | Unique mobile (normalized to `+91...`) |
| `password` | String | Yes | 8–128 characters | Account password (hashed via bcrypt) |
| `roleId` | Number/String | Yes | Valid role ID or name | Target subordinate role (e.g. `2` or `"Sub Admin"`) |
| `state` | String | No | Max 100 characters | State (e.g. `"Maharashtra"`) |
| `city` | String | No | Max 100 characters | City (e.g. `"Mumbai"`) |

#### Request Example:
```json
{
  "name": "Rajesh Sharma",
  "email": "rajesh.sa@aquapay.com",
  "mobile": "9811223344",
  "state": "Maharashtra",
  "city": "Mumbai",
  "password": "SecurePassword123!",
  "roleId": 2
}
```

#### Success Response (`201 Created`):
```json
{
  "statusCode": 201,
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 2,
    "name": "Rajesh Sharma",
    "email": "rajesh.sa@aquapay.com",
    "mobile": "+919811223344",
    "state": "Maharashtra",
    "city": "Mumbai",
    "role_id": 2,
    "company_id": 1,
    "parent_id": 1,
    "status": "active",
    "created_at": "2026-10-17T11:00:00.000Z",
    "role_name": "Sub Admin",
    "role_slug": "SA",
    "parent_name": "System Admin",
    "company_name": "AquaPay Fintech Ltd"
  }
}
```

#### Error Responses:
* **`400 Bad Request`** — Validation failure or invalid role:
  ```json
  {
    "statusCode": 400,
    "success": false,
    "message": "Name must contain only letters and spaces",
    "code": "VALIDATION_ERROR",
    "errors": ["Name must contain only letters and spaces"]
  }
  ```
* **`401 Unauthorized`** — Missing authentication or actor context:
  ```json
  {
    "statusCode": 401,
    "success": false,
    "message": "Authentication required",
    "code": "UNAUTHORIZED"
  }
  ```
* **`403 Forbidden`** — Creator role not authorized to create requested role:
  ```json
  {
    "statusCode": 403,
    "success": false,
    "message": "Role 'Sub Admin' is not authorized to create a 'Admin'",
    "code": "FORBIDDEN"
  }
  ```
* **`409 Conflict`** — Duplicate email or mobile number:
  ```json
  {
    "statusCode": 409,
    "success": false,
    "message": "Email already exists",
    "code": "DUPLICATE_ENTRY"
  }
  ```

#### cURL Example (with JWT):
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "name": "Rajesh Sharma",
    "email": "rajesh.sa@aquapay.com",
    "mobile": "9811223344",
    "state": "Maharashtra",
    "city": "Mumbai",
    "password": "SecurePassword123!",
    "roleId": 2
  }'
```

#### cURL Example (with `x-user-id`):
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "name": "Rajesh Sharma",
    "email": "rajesh.sa@aquapay.com",
    "mobile": "9811223344",
    "state": "Maharashtra",
    "city": "Mumbai",
    "password": "SecurePassword123!",
    "roleId": 2
  }'
```

---

## 5. End-to-End Workflow Flowchart

```
1. Server Boot
   └── Verify Oracle MySQL & Auth Config
   └── GET /api/health (200 OK)

2. One-Time Setup
   └── POST /api/admin/create (Headers: x-admin-setup-key)
       └── Creates Admin (Role 1) & Company (ID 1)

3. Authentication
   └── POST /api/auth/login (email or mobile)
       └── Returns Bearer JWT & user profile

4. User Hierarchy Creation
   └── POST /api/users (Headers: Authorization: Bearer <JWT>)
       ├── Admin creates Sub Admin (Role 2)
       ├── Sub Admin creates NSM (Role 3)
       ├── NSM creates SH (Role 4)
       ├── SH creates CNF (Role 5)
       ├── CNF creates Master Distributor (Role 6)
       ├── Master Distributor creates Distributor (Role 7)
       └── Distributor creates Retailer (Role 8)
```
