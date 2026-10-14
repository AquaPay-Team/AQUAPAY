# Users Module — User Creation API

This module provides the User Creation API for the AQUAPAY fintech KYC platform according to the approved backend architecture and MySQL Workbench schema.

---

## Endpoint Overview

### **POST /api/users**
Creates a new child user within the organization under the authenticated creator's hierarchy.

---

## Authentication & Authorization

* **Requester Context**: Derived securely from `req.user.id` or the `x-user-id` header (never trust client-supplied `parent_id` in request body).
* **Company Scoping**: The newly created user is automatically assigned to the authenticated creator's `company_id`.

### Permitted Role Creation Hierarchy

The platform strictly enforces the following creation chain:

| Requester Role | Can Create | Notes |
| :--- | :--- | :--- |
| **Admin (AD)** | **Any subordinate role** | Admin has full organizational authority (can create Sub Admin, NSM, SH, CHF, MD, DT, RT) |
| **Sub Admin (SA)** | **National State Manager (NSM)** only | Can only create and manage their direct NSMs |
| **National State Manager (NSM)** | **State Head (SH)** only | Can only create and manage their direct State Heads |
| **State Head (SH)** | **CHF (CNF)** only | Can only create and manage their direct CHF / CNF |
| **CHF (CNF)** | **Master Distributor (MD)** only | Can only create and manage their direct Master Distributors |
| **Master Distributor (MD)** | **Distributor (DT)** only | Can only create and manage their direct Distributors |
| **Distributor (DT)** | **Retailer (RT)** only | Can only create and manage their direct Retailers |
| **Retailer (RT)** | *None* | End-node in the hierarchy; cannot create users |

Attempts to bypass the chain (e.g. Sub Admin trying to create Retailer directly) return `403 Forbidden`.


---

## Request Details

* **Method**: `POST`
* **URL**: `/api/users`
* **Headers**:
  * `Content-Type: application/json`
  * `x-user-id`: Integer (ID of the authenticated creator user)

### Request Body Fields

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `name` | String | **Yes** | Full name of the user (min 2 characters) | `"Jane Doe"` |
| `email` | String | **Yes** | Valid, unique email address | `"jane.doe@example.com"` |
| `mobile` | String | **Yes** | Valid, unique 10–15 digit phone number | `"9876543210"` |
| `password` | String | **Yes** | Plaintext password (min 8 characters, hashed with bcrypt before storage) | `"SecurePass@123"` |
| `role_id` | Integer / String | **Yes** | Target role ID (or role name) to assign | `2` |

### Sample Request

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "mobile": "9876543210",
  "password": "SecurePass@123",
  "role_id": 2
}
```

---

## Response Formats

### 1. Success Response (`201 Created`)

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 15,
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "mobile": "9876543210",
    "role_id": 2,
    "company_id": 1,
    "parent_id": 1,
    "status": "active",
    "created_at": "2026-10-14T11:20:00.000Z",
    "role_name": "Sub Admin",
    "role_level": 1
  }
}
```

> **Note**: Sensitive credentials (`password`, `password_hash`) are never exposed in the response.

---

## Error Responses

### 2. Validation Error (`400 Bad Request`)
Returned when required fields are missing or formats are invalid.

```json
{
  "success": false,
  "message": "Email is required, Password must contain at least 8 characters",
  "code": "VALIDATION_ERROR",
  "errors": [
    "Email is required",
    "Password must contain at least 8 characters"
  ]
}
```

### 3. Authentication Required (`401 Unauthorized`)
Returned when the creator user ID is missing or the creator account is inactive.

```json
{
  "success": false,
  "message": "Authentication required to create a user",
  "code": "UNAUTHORIZED"
}
```

### 4. Forbidden Role Creation (`403 Forbidden`)
Returned when the creator's role is not authorized to create the requested role level.

```json
{
  "success": false,
  "message": "Role 'Distributor' is not authorized to create a 'Master Distributor'",
  "code": "FORBIDDEN"
}
```

### 5. Duplicate Entry (`409 Conflict`)
Returned when the email or mobile is already registered.

```json
{
  "success": false,
  "message": "Email already exists",
  "code": "DUPLICATE_ENTRY"
}
```

### 6. Internal Server Error (`500`)

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Database Schema Compatibility

All operations comply with the approved MySQL schema:
* `users`: `id`, `name`, `email`, `mobile`, `password_hash`, `role_id`, `company_id`, `parent_id`, `status`, `created_at`
* `roles`: `id`, `name`, `level`, `created_at`
* `companies`: `id`, `company_name`, `status`
* `role_hierarchy`: `parent_role_id`, `child_role_id`
