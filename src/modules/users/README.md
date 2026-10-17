# Users Module — Complete User Management & Hierarchy API

This module provides the complete User Management lifecycle for the AQUAPAY fintech platform with strict role hierarchy and downline branch isolation.

---

## 1. Endpoints Overview

| Method | Endpoint | Description | Permitted Roles |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/users` | Create a permitted child user down in caller's hierarchy | Admin, Sub Admin, NSM, SH, CHF, MD, DT |
| **GET** | `/api/users` | List downline users (with pagination, role & search filters) | Admin (all users); Sub Admin/NSM/etc. (only their created children) |
| **GET** | `/api/users/:id` | Get user details within caller's downline | Admin (all users); Sub Admin/NSM/etc. (only their created children) |
| **PUT** | `/api/users/:id` | Update profile fields (`name`, `mobile`, `state`, `city`) | Admin (all users); Sub Admin/NSM/etc. (only their created children) |
| **PATCH** | `/api/users/:id/status` | Update user status (`active`, `inactive`, `suspended`) | Admin (all users); Sub Admin/NSM/etc. (only their created children; cannot self-modify) |
| **DELETE** | `/api/users/:id` | Delete user account | Admin (all users); Sub Admin/NSM/etc. (only their created children; cannot self-delete) |

---

## 2. Role Hierarchy & Permission Rules

The platform follows a strict level-based rank hierarchy (Level 0 to 7):

```
Level 0: Admin (System Owner)
   └── Level 1: Sub Admin
         └── Level 2: NSM (National State Manager)
               └── Level 3: SH (State Head)
                     └── Level 4: CHF (CNF / C&F)
                           └── Level 5: Master Distributor
                                 └── Level 6: Distributor
                                       └── Level 7: Retailer (Leaf Node)
```

### Hierarchy Rules:
1. **Creation Rule (`child.level > parent.level`)**:
   - **Admin (Level 0)**: Can create any subordinate role (Sub Admin, NSM, SH, CHF, MD, DT, RT). Cannot create another Admin.
   - **Sub Admin (Level 1)**: Can create all subordinate roles (NSM, SH, CHF, MD, DT, RT). Cannot create Admin or Sub Admin.
   - **NSM (Level 2)**: Can create all subordinate roles (SH, CHF, MD, DT, RT). Cannot create Admin, Sub Admin, or NSM.
   - **SH, CHF, MD, DT (Levels 3–6)**: Can create any role deeper in their hierarchy.
   - **Retailer (Level 7)**: Leaf node; cannot create child accounts.

2. **Branch Isolation Rule (Seeing, Editing, Deleting, and Updating Status)**:
   - **Admin**: Has global visibility and control. Admin can see, edit, update status, and delete **all child users** across the entire organization.
   - **Sub Admin**: Can **ONLY see, edit, update status, and delete their own created children** (and descendants in their downline tree). Sub Admin A has zero visibility or control over Sub Admin B or users created by Sub Admin B.
   - **NSM**: Can **ONLY see, edit, update status, and delete their own created children** (and descendants in their downline tree). NSM 1 cannot see or manage users created by other NSMs or other Sub Admins.
   - **Self-Protection Safeguards**:
     - No user can delete their own account (`400 Bad Request`).
     - No user can modify their own account status (`400 Bad Request`).

---

## 3. Endpoints Detail

### 1. Create User (`POST /api/users`)
* **Headers**: `Content-Type: application/json`, `x-user-id: <creator_id>`
* **Body**:
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

### 2. List Users (`GET /api/users`)
* **Headers**: `x-user-id: <actor_id>`
* **Query Parameters**:
  * `page` (default: 1), `limit` (default: 20, max: 100)
  * `status` (`active`, `inactive`, `suspended`, `pending`)
  * `roleId` or `role` (Filter by role ID or name)
  * `search` (Search substring in name, email, or mobile)
  * `scope`: `all` (full downline tree) or `direct` (direct created children only)

### 3. Get User (`GET /api/users/:id`)
* **Headers**: `x-user-id: <actor_id>`
* Returns `404 Not Found` if user does not exist or is outside the caller's downline tree.

### 4. Update Profile (`PUT /api/users/:id`)
* **Headers**: `x-user-id: <actor_id>`
* **Body**: `{ "name": "...", "mobile": "...", "state": "...", "city": "..." }`

### 5. Update Status (`PATCH /api/users/:id/status`)
* **Headers**: `x-user-id: <actor_id>`
* **Body**: `{ "status": "suspended" }` (or `active`, `inactive`)

### 6. Delete User (`DELETE /api/users/:id`)
* **Headers**: `x-user-id: <actor_id>`
* Deletes user if target is within caller's downline and target is not self.