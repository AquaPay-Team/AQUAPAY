# API Contract — Initial Plan

Agree on request/response details before implementation. Protected endpoints require authentication and authorization.

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| AUTH-01 | POST | `/api/auth/login` | Authenticate user and issue JWT |
| AUTH-02 | GET | `/api/auth/me` | Return current user's safe profile |
| ROLE-01 | GET | `/api/roles` | Return roles caller may assign |
| USR-01 | POST | `/api/users` | Create a permitted child user |
| USR-02 | GET | `/api/users` | List visible users with pagination |
| USR-03 | GET | `/api/users/:id` | Read one accessible user |
| USR-04 | PUT | `/api/users/:id` | Update permitted user fields |
| USR-05 | PATCH | `/api/users/:id/status` | Change account status under policy |
| COMP-01 | POST | `/api/companies` | Create company if separate endpoint is required |
| COMP-02 | GET | `/api/companies/:id` | Read accessible company details |
| KYC-01 | POST | `/api/kyc/applications` | Create KYC application (later phase) |
| KYC-02 | GET | `/api/kyc/applications/:id` | Read KYC application (later phase) |
| KYC-03 | PATCH | `/api/kyc/applications/:id/status` | Update review status (later phase) |

## Standard success response
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {}
}
```

## Standard error response
```json
{
  "success": false,
  "message": "Invalid request",
  "code": "VALIDATION_ERROR"
}
```
