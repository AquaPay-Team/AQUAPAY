# Step 7 — AquaPay KYC Final Submission Module

This module implements **Step 7** of the Phase 2 KYC onboarding pipeline: **Final Application Submission & Status Confirmation**.

---

## 1. Endpoints

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/kyc/submit` | `requireAuth` | Checks submission readiness, pending prerequisite steps, and current status. |
| `GET` | `/api/kyc/submission-status` | `requireAuth` | Alias for checking current submission status. |
| `POST` | `/api/kyc/submit` | `requireAuth` | Validates completion of Steps 1–6, completes Step 7, transitions case status to `submitted`, and logs audit trail. |

---

## 2. API Specifications

### `GET /api/kyc/submit`
Fetches whether the application is ready for submission and lists any incomplete steps.

#### Success Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": {
    "caseId": 25,
    "status": "pending",
    "submittedAt": null,
    "reviewedAt": null,
    "rejectionReason": null,
    "steps_completed": 6,
    "isReadyForSubmission": true,
    "isSubmitted": false,
    "incompleteSteps": [],
    "message": "All prerequisites completed. Ready for final submission."
  },
  "message": "KYC submission status retrieved successfully",
  "success": true
}
```

---

### `POST /api/kyc/submit`
Performs final submission of the application.

#### Request Body (Optional)
```json
{
  "confirm": true,
  "notes": "All documents verified"
}
```

#### Success Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": {
    "alreadySubmitted": false,
    "caseId": 25,
    "status": "submitted",
    "submittedAt": "2026-11-03T11:34:25.123Z",
    "steps_completed": 7,
    "message": "Your KYC application has been successfully submitted and is under verification."
  },
  "message": "KYC application submitted successfully",
  "success": true
}
```

#### Incomplete Steps Error (`400 Bad Request`)
If any of Steps 1 through 6 are not completed, submission fails closed:
```json
{
  "statusCode": 400,
  "message": "Cannot submit KYC. Please complete previous steps first: Agent Agreement Acceptance",
  "errors": [
    {
      "stepNumber": 6,
      "name": "Agent Agreement Acceptance"
    }
  ],
  "code": "INCOMPLETE_KYC_STEPS"
}
```

---

## 3. Database Coordination

1. **`kyc_cases`**:
   - Updates `status = 'submitted'`, `submitted_at = CURRENT_TIMESTAMP`, `steps_completed = 7`.
2. **`kyc_steps`**:
   - Updates Step 7 (`step_number = 7`) to `status = 'completed'` and `completed_at = CURRENT_TIMESTAMP`.
3. **`kyc_status_history`**:
   - Inserts audit row `{ case_id, old_status: 'pending', new_status: 'submitted', actor_user_id, reason }`.

