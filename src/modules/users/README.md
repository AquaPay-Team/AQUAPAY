# Users Module — User Creation API

This module provides the User Creation endpoint for the AQUAPAY fintech platform with server-side role hierarchy enforcement.

## 1. Endpoint Overview

| Method | Endpoint     | Description                                                      |
| ------ | ------------ | ---------------------------------------------------------------- |
| POST   | `/api/users` | Create a permitted child user within the caller's role hierarchy |

## 2. Role Hierarchy and Permission Rules

The API uses the database's `role_hierarchy` table to determine which roles a user can create. It does not rely on a `level` column in the `roles` table.

The configured hierarchy is:

```text
Admin (AD)
└── Sub Admin (SA)
    └── NSM
        └── SH
            └── CNF
                └── Master Distributor (MD)
                    └── Distributor (DT)
                        └── Retailer (RT)
```

### Creation rules

- **Admin:** Can create any role that is a descendant of Admin in `role_hierarchy`.
- **Sub Admin, NSM, SH, CNF, Master Distributor, and Distributor:** Can create permitted descendant roles according to `role_hierarchy`.
- **Retailer:** Cannot create child accounts under the configured hierarchy.
- A user cannot create another user with the same role through this endpoint.
- The service verifies the creator's active status and checks the requested parent-child role relationship on the server.
- The creator's `parent_id` and `company_id` are derived from the authenticated creator; clients must not supply these values to control ownership.

**Important:** With the configured direct-child chain, Admin can create Sub Admin directly, but can create Retailer only if the database hierarchy permits that relationship through its descendant chain. The service uses recursive hierarchy checking.

## 3. Authentication

The endpoint requires authentication middleware.

**Headers**

```http
Content-Type: application/json
Authorization: Bearer <valid-token>
```

Do not use `x-user-id` or `user-id` headers to establish identity. The authenticated creator ID must come from `req.user.id`, populated by the authentication middleware after verifying the JWT.

Requests without valid authentication should be rejected with `401 Unauthorized`.

## 4. Create User Request

**Endpoint:** `POST /api/users`

**Request body**

```json
{
  "name": "Rajesh Sharma",
  "email": "rajesh@aquapay.com",
  "mobile": "9876543210",
  "state": "Maharashtra",
  "city": "Mumbai",
  "password": "SecurePassword123!",
  "roleId": 2
}
```

| Field      | Required | Description                                                 |
| ---------- | -------- | ----------------------------------------------------------- |
| `name`     | Yes      | User's name                                                 |
| `email`    | Yes      | Valid email address; must be unique                         |
| `mobile`   | Yes      | Valid Indian mobile number; must be unique                  |
| `password` | Yes      | Password of 8–128 characters                                |
| `roleId`   | Yes      | Existing role ID, role name, or slug supported by the model |
| `state`    | No       | State, up to 100 characters                                 |
| `city`     | No       | City, up to 100 characters                                  |

The current validator also accepts `role_id` or `role` as alternative role input fields. Prefer `roleId` for new requests.

Use unique email and mobile values and a non-production database when testing.

## 5. Processing and Database Rules

The service:

1. Verifies that the authenticated creator exists and is active.
2. Resolves the requested role.
3. Checks the permitted role hierarchy.
4. Checks for duplicate email and mobile values.
5. Hashes the password using `bcryptjs`.
6. Derives `parent_id` and `company_id` from the creator.
7. Inserts the new user within a database transaction.
8. Returns the safe user profile without the password or password hash.

The implementation uses the existing `users`, `roles`, `companies`, and `role_hierarchy` tables. The `roles` table has `id`, `name`, and `slug`; it does not have a `level` column.

## 6. Expected Error Cases

| HTTP status                 | Scenario                                               |
| --------------------------- | ------------------------------------------------------ |
| `400 Bad Request`           | Invalid request fields or unknown role                 |
| `401 Unauthorized`          | Missing or invalid authentication, or inactive creator |
| `403 Forbidden`             | Creator is not permitted to create the requested role  |
| `409 Conflict`              | Email or mobile number already exists                  |
| `500 Internal Server Error` | Unexpected server or database error                    |

The exact response structure depends on the application's shared error middleware.

## 7. Local Testing

Start the application using the script configured in `package.json`:

```bash
npm run dev
```

Test the configured health endpoint:

```http
GET http://localhost:3000/api/health
```

Test `POST /api/users` with a valid JWT and a role permitted by the actual database hierarchy.

### Test checklist

- [ ] Missing or invalid authentication returns `401`.
- [ ] Missing or invalid required fields return `400`.
- [ ] An unknown role returns `400`.
- [ ] A disallowed role relationship returns `403`.
- [ ] Duplicate email or mobile returns `409`.
- [ ] Successful creation returns `201`.
- [ ] The database stores a password hash, not the plaintext password.
- [ ] The response does not expose `password` or `password_hash`.
- [ ] Failed creation does not leave a partial user record.
- [ ] The existing Admin API and authentication endpoints continue to work.
- [ ] Automated tests pass.

Run the configured test suite:

```bash
npm test
```

## 8. Before Merging

- [ ] Authentication relies on verified JWT identity, not user-supplied headers.
- [ ] Role permissions match the seeded `role_hierarchy` rows.
- [ ] Database queries match the approved schema.
- [ ] Validation, duplicate, forbidden, and unauthenticated cases are tested.
- [ ] No environment files, secrets, tokens, or private KYC data are staged.
- [ ] Review `git status`, `git diff`, and staged changes before committing.
