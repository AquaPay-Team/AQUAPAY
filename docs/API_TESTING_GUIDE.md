# AquaPay API Testing Guide

This guide provides end-to-end documentation for testing all endpoints in the AquaPay backend, including authentication headers, request payloads, expected responses, and test flows.

---

## 1. Quick Start & Prerequisites

- **Base URL**: `http://localhost:3000`
- **Environment**: Ensure `.env` is configured and MySQL is running.
- **Start Development Server**:
  ```bash
  npm run dev
  ```
  *(Using nodemon ensures any code edits automatically hot-reload)*
- **Run Automated Test Suite (31 unit & integration tests)**:
  ```bash
  npm test
  ```

---

## 2. Authentication Headers Reference

| Header Name | Type | Purpose | Permitted Endpoints |
| :--- | :--- | :--- | :--- |
| **`x-admin-setup-key`** | String | Secret key for one-time Admin bootstrapping | `POST /api/admin/create` |
| **`x-user-id`** | Number / String | Identifies the caller/actor executing the request (e.g. `1` for Admin) | All `/api/users/*` endpoints |
| **`Content-Type`** | String | Must be set to `application/json` | All `POST`, `PUT`, `PATCH` endpoints |

---

## 3. Role Hierarchy & Rules Reference

```
Level 0 / 1: Admin (System Owner — Global Visibility)
    └── Level 1 / 2: Sub Admin
          └── Level 2 / 3: NSM (National State Manager)
                └── Level 3 / 4: SH (State Head)
                      └── Level 4 / 5: CHF (CNF / C&F)
                            └── Level 5 / 6: Master Distributor
                                  └── Level 6 / 7: Distributor
                                        └── Level 7 / 8: Retailer (Leaf Node)
```

### Hierarchy Rules:
1. **Creation Rule (`child.level > parent.level`)**:
   - Any manager can create any role strictly *below* them in hierarchy.
   - Nobody can create an account equal to or higher than their own level.
   - Retailer cannot create child users.
2. **Branch Isolation**:
   - **Admin** can see, edit, update status, and delete **all child accounts** globally.
   - **Sub Admin / NSM / etc.** can **only** see, edit, update status, and delete users in their own downline branch.
3. **Self Protection**:
   - Users cannot modify their own status (`400 Bad Request`).
   - Users cannot delete their own account (`400 Bad Request`).

---

## 4. Endpoints Reference & Test Payloads

### 4.1 Health Check

#### `GET /api/health`
Verifies server health and uptime.

* **Headers**: None required
* **cURL**:
  ```bash
  curl -X GET http://localhost:3000/api/health
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-10-16T12:00:00.000Z",
    "uptime": 120.45
  }
  ```

---

### 4.2 Admin One-Time Setup

#### `POST /api/admin/create`
Bootstraps the root Admin account with company association.

* **Headers**:
  * `Content-Type: application/json`
  * `x-admin-setup-key: aquapay_admin_setup_secret_key_2026`
* **Request Body**:
  ```json
  {
    "name": "System Admin",
    "email": "admin.primary@aquapay.com",
    "mobile": "9998887776",
    "companyName": "AquaPay Fintech Ltd",
    "password": "AdminPassword123!"
  }
  ```
* **cURL**:
  ```bash
  curl -X POST http://localhost:3000/api/admin/create \
    -H "Content-Type: application/json" \
    -H "x-admin-setup-key: aquapay_admin_setup_secret_key_2026" \
    -d "{\"name\":\"System Admin\",\"email\":\"admin.primary@aquapay.com\",\"mobile\":\"9998887776\",\"companyName\":\"AquaPay Fintech Ltd\",\"password\":\"AdminPassword123!\"}"
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "statusCode": 201,
    "data": {
      "id": 1,
      "name": "System Admin",
      "email": "admin.primary@aquapay.com",
      "companyId": 1,
      "roleId": 1,
      "status": "active"
    },
    "message": "Admin user and company created successfully",
    "success": true
  }
  ```

---

### 4.3 Create Child User

#### `POST /api/users`
Creates a new child account down in the caller's hierarchy.

* **Headers**:
  * `Content-Type: application/json`
  * `x-user-id: 1` *(ID of the creator)*
* **Request Body**:
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
* **cURL**:
  ```bash
  curl -X POST http://localhost:3000/api/users \
    -H "Content-Type: application/json" \
    -H "x-user-id: 1" \
    -d "{\"name\":\"Rajesh Sharma\",\"email\":\"rajesh.sa@aquapay.com\",\"mobile\":\"9811223344\",\"state\":\"Maharashtra\",\"city\":\"Mumbai\",\"password\":\"SecurePassword123!\",\"roleId\":2}"
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "statusCode": 201,
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
      "created_by": 1,
      "status": "active",
      "role_name": "Sub Admin"
    },
    "message": "User created successfully",
    "success": true
  }
  ```

---

### 4.4 List Downline Users

#### `GET /api/users`
Retrieves paginated users in the caller's authorized downline.

* **Headers**:
  * `x-user-id: 1`
* **Query Parameters (Optional)**:
  * `page`: Page number (default: `1`)
  * `limit`: Page size (default: `20`, max: `100`)
  * `search`: Substring search matching `name`, `email`, or `mobile`
  * `roleId`: Filter by role ID (e.g. `2`)
  * `status`: Filter by status (`active`, `inactive`, `suspended`)
  * `scope`: `all` (entire downline subtree) or `direct` (direct created children only)
* **cURL**:
  ```bash
  curl -X GET "http://localhost:3000/api/users?page=1&limit=20&scope=all" \
    -H "x-user-id: 1"
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "items": [
        {
          "id": 2,
          "name": "Rajesh Sharma",
          "email": "rajesh.sa@aquapay.com",
          "mobile": "+919811223344",
          "role_name": "Sub Admin",
          "role_level": 1,
          "status": "active"
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    },
    "message": "Users fetched successfully",
    "success": true
  }
  ```

---

### 4.5 Get Single User Details

#### `GET /api/users/:id`
Retrieves a single user's safe profile within the caller's downline.

* **Headers**:
  * `x-user-id: 1`
* **cURL**:
  ```bash
  curl -X GET http://localhost:3000/api/users/2 \
    -H "x-user-id: 1"
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "id": 2,
      "name": "Rajesh Sharma",
      "email": "rajesh.sa@aquapay.com",
      "mobile": "+919811223344",
      "state": "Maharashtra",
      "city": "Mumbai",
      "role_id": 2,
      "role_name": "Sub Admin",
      "status": "active"
    },
    "message": "User details fetched successfully",
    "success": true
  }
  ```

---

### 4.6 Update User Profile

#### `PUT /api/users/:id`
Updates profile fields (`name`, `mobile`, `state`, `city`).

* **Headers**:
  * `Content-Type: application/json`
  * `x-user-id: 1`
* **Request Body**:
  ```json
  {
    "name": "Rajesh Kumar Sharma",
    "city": "Navi Mumbai"
  }
  ```
* **cURL**:
  ```bash
  curl -X PUT http://localhost:3000/api/users/2 \
    -H "Content-Type: application/json" \
    -H "x-user-id: 1" \
    -d "{\"name\":\"Rajesh Kumar Sharma\",\"city\":\"Navi Mumbai\"}"
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "id": 2,
      "name": "Rajesh Kumar Sharma",
      "email": "rajesh.sa@aquapay.com",
      "city": "Navi Mumbai"
    },
    "message": "User updated successfully",
    "success": true
  }
  ```

---

### 4.7 Update User Status

#### `PATCH /api/users/:id/status`
Updates status (`active`, `inactive`, `suspended`). Cannot self-modify.

* **Headers**:
  * `Content-Type: application/json`
  * `x-user-id: 1`
* **Request Body**:
  ```json
  {
    "status": "suspended"
  }
  ```
* **cURL**:
  ```bash
  curl -X PATCH http://localhost:3000/api/users/2/status \
    -H "Content-Type: application/json" \
    -H "x-user-id: 1" \
    -d "{\"status\":\"suspended\"}"
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "id": 2,
      "status": "suspended"
    },
    "message": "User status updated to suspended successfully",
    "success": true
  }
  ```

---

### 4.8 Delete User

#### `DELETE /api/users/:id`
Deletes a user within the caller's downline. Cannot self-delete.

* **Headers**:
  * `x-user-id: 1`
* **cURL**:
  ```bash
  curl -X DELETE http://localhost:3000/api/users/2 \
    -H "x-user-id: 1"
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "statusCode": 200,
    "data": {
      "id": 2
    },
    "message": "User deleted successfully",
    "success": true
  }
  ```

---

## 5. Negative Test Scenarios & Validation Errors

### 5.1 Reject Numbers or Symbols in Name (`400 Bad Request`)
* **Request**:
  ```json
  {
    "name": "Rajesh Kumar 123",
    "email": "name.invalid@aquapay.com",
    "mobile": "9811223361",
    "roleId": 2,
    "password": "Password@123"
  }
  ```
* **Expected Response**:
  ```json
  {
    "statusCode": 400,
    "success": false,
    "message": "Name must contain only letters and spaces",
    "errors": [
      "Name must contain only letters and spaces"
    ],
    "code": "VALIDATION_ERROR"
  }
  ```

### 5.2 Missing Authentication Header (`401 Unauthorized`)
* **Request without `x-user-id` header**:
* **Expected Response**:
  ```json
  {
    "statusCode": 401,
    "success": false,
    "message": "Authentication required",
    "code": "UNAUTHORIZED"
  }
  ```

### 5.3 Hierarchy Violation: Creating Role Above Caller (`403 Forbidden`)
* **Scenario**: Sub Admin (ID: 2) tries to create another Admin (Role ID: 1) or Sub Admin (Role ID: 2).
* **Expected Response**:
  ```json
  {
    "statusCode": 403,
    "success": false,
    "message": "You can only create roles subordinate to your level",
    "code": "FORBIDDEN"
  }
  ```

### 5.4 Self Modification Prevention (`400 Bad Request`)
* **Scenario**: User ID 1 tries to call `PATCH /api/users/1/status` or `DELETE /api/users/1`.
* **Expected Response**:
  ```json
  {
    "statusCode": 400,
    "success": false,
    "message": "Cannot modify your own account status",
    "code": "INVALID_OPERATION"
  }
  ```

### 5.5 Target Outside Downline (`404 Not Found`)
* **Scenario**: Sub Admin A (ID: 2) tries to view or edit User created by Sub Admin B (ID: 8).
* **Expected Response**:
  ```json
  {
    "statusCode": 404,
    "success": false,
    "message": "User not found or outside your authorized downline",
    "code": "NOT_FOUND"
  }
  ```
