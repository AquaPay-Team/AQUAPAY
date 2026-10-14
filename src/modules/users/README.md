AQUAPAY --- Users Module
The Users module provides the user-creation endpoint for the AQUAPAY
fintech KYC backend. It validates input, checks the creator's active
account and permitted role relationship, hashes passwords with bcrypt,
and stores the new user using the shared MySQL connection pool.
> **Current status:** This README documents the implementation and
> testing workflow. Do not consider the endpoint production-ready until
> verified authentication middleware populates `req.user` and the
> database migrations/seeds are reconciled with the approved schema.
1. API overview
Item              Value
---
Feature           Create a child user
Method            `POST`
Endpoint          `/api/users`
Local base URL    `http://localhost:3000`
Health endpoint   `GET /api/health`
Route file        `src/modules/users/user.routes.js`
Controller        `src/modules/users/user.controller.js`
Service           `src/modules/users/user.service.js`
Model             `src/modules/users/user.model.js`
Validator         `src/modules/users/user.validator.js`
2. Authentication and authorization
The controller reads the creator ID from `req.user.id`. That property
must be populated by trusted authentication middleware.
Do not trust `x-user-id`, `user-id`, or a body-supplied
`parent_id` as proof of identity.
The API assigns `parent_id` from the authenticated creator and
derives `company_id` from that creator.
The service checks that the creator exists and is active, that the
target role exists, and that the parent-to-child role pair is
present in `role_hierarchy`.
A forbidden parent/child role pair should return `403 Forbidden`.
Without authentication middleware, `req.user` will be missing and
the controller should return `401 Unauthorized`. Do not bypass this
by restoring an untrusted header fallback.
Configured role chain
The current database hierarchy is a direct-child chain:
Creator role              Permitted child role
---
Admin (AD)                Sub Admin (SA)
Sub Admin (SA)            NSM
NSM                       SH
SH                        CNF
CNF                       Master Distributor (MD)
Master Distributor (MD)   Distributor (DT)
Distributor (DT)          Retailer (RT)
Retailer (RT)             None
The API follows the rows in the database `role_hierarchy` table. Under
this chain, Admin cannot directly create a Retailer unless the approved
database hierarchy is intentionally changed.
3. Request
Headers
``` http
Content-Type: application/json
Authorization: Bearer <valid-token>
```
The Authorization header is illustrative: use it only after the
project's authentication middleware is implemented and configured. The
request must not use `x-user-id` as production authentication.
JSON body
---
Field             Type              Required          Rules
---
`name`            string            Yes               At least 2
characters
`email`           string            Yes               Valid email; must
be unique
`mobile`          string            Yes               Valid 10--15 digit
mobile number;
must be unique
`password`        string            Yes               At least 8
characters
`role_id`         integer or        Yes               Must identify an
supported role                      existing role
identifier                          permitted by
`role_hierarchy`
Example:
``` json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "mobile": "9876543210",
  "password": "Use-A-Test-Password-Only",
  "role_id": 2
}
```
Use unique test email/mobile values and a non-production database.
4. Responses
Success --- `201 Created`
The response should contain public user fields only. Never return
`password` or `password_hash`.
Example shape (actual fields depend on the current `ApiResponse` and
model implementation):
``` json
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
    "role_name": "Sub Admin",
    "role_slug": "SA"
  }
}
```
Do not assume a `role_level` field: the approved `roles` table has no
`level` column.
Expected error cases
---
Status                              Scenario
---
`400 Bad Request`                   Missing or invalid request fields /
unknown target role
`401 Unauthorized`                  Missing trusted creator context or
creator is not active
`403 Forbidden`                     Creator is not permitted to create
the requested child role
`409 Conflict`                      Email or mobile number already
exists
`500 Internal Server Error`         Unexpected server/database failure
The exact response body should be checked against `ApiError`,
`httpStatus`, and `error.middleware.js`; do not assume optional `code`
or `errors` fields unless the implementation returns them.
5. Approved schema compatibility
The implementation should use the actual agreed MySQL columns:
`users`: `id`, `name`, `email`, `mobile`, `company_id`, `role_id`,
`parent_id`, `password_hash`, `status`, `created_at`, `updated_at`
`roles`: `id`, `name`, `slug`
`companies`: `id`, `name`, `created_at`
`role_hierarchy`: `parent_role_id`, `child_role_id`
The `roles` table does not have `level`; `companies` uses `name`,
not `company_name`. Review migration and seed scripts before running
them: older proposed migration files may define a conflicting schema.
Never run an unreviewed initializer against production or a database
containing important data.
6. Run locally
From the project root:
``` bash
npm install
npm run dev
```
Use the start script actually defined in `package.json` if it differs.
Confirm the port from the startup output and `.env`; never copy
credentials from another machine.
Health check:
``` http
GET http://localhost:3000/api/health
```
Expected status: `200 OK` if the health route is configured and the
server is running.
7. Test checklist
Record the actual status and result for each applicable case in Postman
or the project's test suite.
---
#                      Test                    Expected result
---
1                       Health check            `200 OK`
2                       Missing required fields `400` validation error
3                       Invalid email / short   `400` validation error
password / invalid  
mobile
4                       No authenticated        `401 Unauthorized`
creator context
5                       Inactive or nonexistent `401 Unauthorized`
creator
6                       Valid direct-child role `201 Created` when
and unique details      authentication is
configured
7                       Duplicate email         `409 Conflict`
8                       Duplicate mobile        `409 Conflict`
9                       Disallowed parent/child `403 Forbidden`
role pair
10                      Unknown target role     `400 Bad Request`
11                      Password storage        Database contains a
bcrypt hash, not
plaintext
12                      Response security       No password or password
hash in response
13                      Database transaction    Failed creation leaves
no partial user row
14                      Existing Admin API      Still works after
integration
15                      Error handling          No stack trace/secrets
exposed in client
response
Suggested Postman requests
Validation test
`POST http://localhost:3000/api/users`
``` json
{
  "name": "A",
  "email": "not-an-email",
  "password": "123"
}
```
Expected: `400 Bad Request`. Confirm that the response identifies all
applicable validation errors; the request intentionally omits mobile and
role.
Missing authentication test
Send a valid-looking body without trusted authentication credentials.
Expected: `401 Unauthorized`.
Successful creation test
Only run after trusted authentication middleware is configured and a
suitable active creator exists in the local test database. Use a role
directly beneath that creator's role in `role_hierarchy`, and use unique
email/mobile values. Verify the response and database row.
Duplicate test
Repeat a successful request with the same email or mobile value.
Expected: `409 Conflict`, with no duplicate row created.
8. Automated tests
Run the project's configured tests:
``` bash
npm test
```
If no test script exists, inspect `package.json` and the repository's
test setup before assuming tests are available. Record the actual
output; do not document tests as passing unless they were run
successfully on the current code.
9. Before committing or opening a PR
[ ] Authentication middleware is implemented and populates
`req.user` from a verified identity.
[ ] No request-header fallback is used to establish identity.
[ ] Migrations and seeds match the approved schema.
[ ] Role hierarchy tests match the actual `role_hierarchy` rows.
[ ] Success, validation, duplicate, forbidden, and unauthenticated
cases were tested.
[ ] Password hashes are stored; secrets are never returned.
[ ] Admin and health endpoints still work.
[ ] Automated tests pass, or missing tests are documented.
[ ] Review `git status`, `git diff`, and staged changes.
[ ] No `.env`, credentials, tokens, or private KYC data are staged.
[ ] Changes are committed and pushed to the intended feature branch.
Useful Git commands:
``` bash
git branch --show-current
git status
git diff
git diff --cached
```
Stage only intended files, inspect the staged diff, then commit and push
from the appropriate branch.
10. Security reminder
A client-supplied user ID is not authentication. Production user
creation must use a verified session/token and server-side
authorization. Keep this endpoint unavailable to untrusted callers until
that flow is implemented and tested.