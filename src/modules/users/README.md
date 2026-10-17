# Users Module — User Creation API

This module provides the User Creation endpoint for the AQUAPAY fintech platform with strict role hierarchy enforcement.

---

## 1. Endpoints Overview

| Method | Endpoint | Description | Permitted Roles |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/users` | Create a permitted child user down in caller's hierarchy | Admin, Sub Admin, NSM, SH, CHF, MD, DT |

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

---

## 3. Endpoints Detail

### Create User (`POST /api/users`)
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