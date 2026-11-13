# Admin Update User API

## Overview

The Admin Update User API allows an authenticated administrator to update an existing user's profile information. It supports partial updates, so only the fields provided in the request are modified.

Only users with `role_id = 1` (Admin) are authorized to perform updates. The administrator's role is verified against the database.

## Endpoint

`PATCH /api/users/:id`

Example:

`PATCH http://localhost:3000/api/users/15`

## Authentication

A valid access token is required.

Headers:

```http
Authorization: Bearer <your_access_token>
Content-Type: application/json
```

## Allowed Fields

| Field | Description |
|---|---|
| `name` | User's name |
| `email` | User's email address |
| `mobile` | User's mobile number |
| `shopname` | Shop or business name |
| `address` | User's address |
| `state` | State |
| `city` | City |
| `pincode` | Postal code |

Fields omitted from the request remain unchanged. Fields outside the allowed list cannot be updated through this endpoint.

## Example Request

```json
{
  "name": "Updated User",
  "email": "updated@example.com",
  "city": "Vadodara"
}
```

## Expected Responses

- `200 OK` — User updated successfully.
- `400 Bad Request` — Invalid user ID or request fields.
- `401 Unauthorized` — Missing or invalid authentication.
- `403 Forbidden` — Authenticated user is not an administrator.
- `404 Not Found` — Target user does not exist.
- `409 Conflict` — Email or mobile number already belongs to another user.

## Security

- Requires authentication.
- Checks the administrator's role against the database.
- Rejects unsupported fields, including role and status changes.
- Returns the updated user's safe profile rather than password data.
- Uses a database transaction for the update operation.
