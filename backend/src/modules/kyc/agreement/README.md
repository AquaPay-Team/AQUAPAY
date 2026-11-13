# Step 6 — AquaPay Agent Agreement Module

This module implements **Step 6** of the Phase 2 KYC onboarding journey: **Agent Agreement Acceptance**, using the official **AquaPay Agent Agreement** text and clauses.

---

## 1. Endpoints

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/kyc/agreement` | `requireAuth` | Fetches the 10 official agreement clauses, dynamically rendered agreement text, and agent signing section. |
| `POST` | `/api/kyc/agreement/accept` | `requireAuth` | Records acceptance of the agreement terms, marks Step 6 completed, and increments durable KYC progress. |

---

## 2. Agreement Clauses

1. I hereby undertake to use Payment Gateway services with my "user ID" only after agreeing to the online agreement on AquaPay portal.
2. I hereby declare that I will use my own Credit Card/Debit Card/Net banking/UPI only.
3. In case of any chargeback or fraud transaction claim, AquaPay reserves the right to recover the amount.
4. AquaPay may suspend settlement during suspicious activities.
5. I agree to use services only for legal business purposes.
6. I will not tamper, hack, or misuse the services.
7. AquaPay shall not be liable for any damages arising from misuse.
8. I confirm all information provided by me is correct.
9. I do not have any criminal background.
10. This declaration is made voluntarily and knowingly.

---

## 3. API Specifications

### `GET /api/kyc/agreement`
Fetches the dynamic agreement document and signing metadata.

#### Success Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": {
    "agreementCode": "AQUAPAY_AGENT_AGREEMENT",
    "agreementVersion": "v1.0",
    "title": "AquaPay Agent Agreement",
    "content": "AquaPay Agent Agreement\n\nThis Agent Agreement (\"Agreement\") is made on this 12 October 2026 by and between:...",
    "clauses": [
      "I hereby undertake to use Payment Gateway services with my \"user ID\" only after agreeing to the online agreement on AquaPay portal.",
      "I hereby declare that I will use my own Credit Card/Debit Card/Net banking/UPI only.",
      "In case of any chargeback or fraud transaction claim, AquaPay reserves the right to recover the amount.",
      "AquaPay may suspend settlement during suspicious activities.",
      "I agree to use services only for legal business purposes.",
      "I will not tamper, hack, or misuse the services.",
      "AquaPay shall not be liable for any damages arising from misuse.",
      "I confirm all information provided by me is correct.",
      "I do not have any criminal background.",
      "This declaration is made voluntarily and knowingly."
    ],
    "signSection": {
      "date": "12 October 2026",
      "place": "Surat City",
      "signatureName": "Chauhan Meet",
      "mobileNumber": "7738647711",
      "disclaimer": "This is a system generated document. No physical signature required."
    },
    "agentDetails": {
      "userId": 12,
      "name": "Chauhan Meet",
      "email": "meet@example.com",
      "mobile": "7738647711",
      "role": "Retailer",
      "shopname": "Meet Telecom",
      "address": "Shop 4, Ring Road",
      "city": "Surat",
      "state": "Gujarat",
      "pincode": "395002",
      "businessType": "Telecom Store"
    },
    "isAccepted": false,
    "acceptedAt": null
  },
  "message": "Agent agreement details retrieved successfully",
  "success": true
}
```

---

### `POST /api/kyc/agreement/accept`
Records the agent's explicit acceptance of the 10 clauses.

#### Request Body
```json
{
  "accepted": true,
  "agreementCode": "AQUAPAY_AGENT_AGREEMENT",
  "agreementVersion": "v1.0"
}
```

#### Success Response (`200 OK`)
```json
{
  "statusCode": 200,
  "data": {
    "accepted": true,
    "agreementCode": "AQUAPAY_AGENT_AGREEMENT",
    "agreementVersion": "v1.0",
    "acceptedAt": "2026-11-03T05:40:00.000Z",
    "steps_completed": 6
  },
  "message": "Agent agreement accepted successfully",
  "success": true
}
```
