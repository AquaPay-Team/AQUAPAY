# AquaPay - Next-Generation Digital Payments & Merchant Banking Portal

AquaPay is an enterprise-grade fintech platform delivering seamless digital onboarding, RBI-compliant 7-step KYC verification, and unified merchant banking services (Payouts, BBPS, UPI Collection, Credit Card Settlement, and Real-Time Transaction Ledgers).

---

## 🏛️ System Architecture

The repository is structured as a full-stack workspace maintaining decoupled backend and frontend architectures:

```text
AQUAPAY/
├── backend/                  # Node.js, Express, MySQL (Aiven) & Redis REST API
│   ├── src/
│   │   ├── config/           # Database, Redis & Environment configurations
│   │   ├── middleware/       # JWT Auth, RBAC, File Uploads & Security
│   │   ├── modules/
│   │   │   ├── auth/         # Authentication & Token Management
│   │   │   ├── kyc/          # 7-Step KYC Compliance Engine
│   │   │   │   ├── digilocker/   # Aadhaar eKYC Integration & Callbacks
│   │   │   │   ├── pan/          # PAN Verification (NSDL / Cashfree)
│   │   │   │   ├── bank/         # Bank Penny Drop (Cashfree / Signzy)
│   │   │   │   ├── media/        # Shop, Selfie & Video Consent Uploads
│   │   │   │   └── agreement/    # Merchant Agreements & PDF Generation
│   │   │   ├── users/        # User Onboarding & 8-Tier Hierarchy
│   │   │   └── admin/        # Admin Approval Workflows & Management
│   └── tests/                # Automated Test Suites (Jest & Supertest)
│
├── frontend/                 # React 19 + Vite + Tailwind CSS User Portal
│   ├── src/
│   │   ├── api/              # Axios API Clients & Endpoints
│   │   ├── components/       # Reusable UI & Layout Components
│   │   │   ├── common/       # DashboardHeader with Search & Notifications
│   │   │   └── user/         # UserSidebar with 8-Tier Role Navigation
│   │   ├── features/
│   │   │   ├── kyc/          # 7-Step KYC Flow Components & Views
│   │   │   └── admin/        # Admin Management Tables & Modals
│   │   ├── layouts/          # UserLayout & AdminLayout
│   │   └── pages/
│   │       ├── user/         # UserDashboard (Wallets, Services, Reports)
│   │       ├── kyc/          # KycVerificationPage
│   │       └── auth/         # Login, Register & Password Recovery
│
└── README.md
```

---

## 🚀 Key Features

### 1. Unified User Dashboard (Merchant Counter UI)
- **Multi-Wallet Overview:** Real-time visibility into Main Wallet, Settlement Wallet, and UPI Wallet with performance indicators.
- **Core Payment Services:**
  - **Payout:** Instant IMPS/NEFT fund transfers.
  - **Credit Card 2:** Direct credit card bill settlements with live bill fetching.
  - **Rupay UPI:** High-speed QR collection & dynamic intent payment processing.
  - **Add Money:** Top-up gateway with tiered MDR package configurations.
- **Real-Time Business Counter:** Instant snapshot of Today's Business, Current Month, Previous Month, and Yearly Growth.
- **All Transaction Report:** Complete ledger with customizable date-range filtering, live search, export capabilities, and pagination.
- **Real-Time Alerts:** Top navigation search bar (`Ctrl + K`), balance quick-pill, and onboarding notification center.

### 2. 7-Step KYC Compliance & Identity Verification Engine
1. **Step 1 - Mobile & Email OTP:** Double-factor identity verification.
2. **Step 2 - Aadhaar eKYC via DigiLocker:** Secure OAuth popup flow with automated cross-window messaging (`postMessage`) and instant state transition.
3. **Step 3 - PAN Card Verification:** Real-time NSDL / Cashfree API verification with automated fuzzy legal name matching against Aadhaar records.
4. **Step 4 - Bank Account Penny Drop:** Live account verification via IMPS penny drop, confirming account holder name and IFSC details.
5. **Step 5 - Multi-Media Document Capture:** Geotagged shop photo, live selfie capture, and video consent recording (with `.mp4` and `.webm` support).
6. **Step 6 - Digital Merchant Agreement:** Formatted legal terms with dynamic user details and tamper-proof agreement download.
7. **Step 7 - Compliance Verification & Approval:** Multi-tier admin review dashboard with approval/rejection workflows.

### 3. 8-Tier Role-Based Access Control (RBAC)
- **Role 1 (AD):** Super Admin (Full Portal & Compliance Control)
- **Role 2 (SA):** Sub-Admin
- **Role 3 (NSM):** National Sales Manager
- **Role 4 (SH):** State Head
- **Role 5 (CNF):** Carry & Forward / State Distributor
- **Role 6 (MD):** Master Distributor
- **Role 7 (DT):** Distributor
- **Role 8 (RT):** Retailer / Merchant Terminal

---

## 🛠️ Technology Stack

- **Backend:** Node.js (v20+), Express.js, MySQL (Aiven Cloud / Self-hosted), Redis (RESP3 compatible)
- **Frontend:** React 19, Vite, Tailwind CSS, Lucide React, React Router v7, Sonner Toasts
- **Testing:** Jest, Supertest, Vitest

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js >= 20.x
- MySQL >= 8.0 or Aiven MySQL
- Redis >= 6.x

### 1. Backend Setup
```bash
cd backend
npm install

# Configure environment variables (.env)
cp .env.example .env

# Run database migrations
npm run migrate

# Start backend development server
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend # or AQUAPAR_2 FRONTEND/Aquapay
npm install

# Start frontend development server
npm run dev

# Build for production
npm run build
```

---

## 🧪 Testing
```bash
cd backend
npm test
```

---

## 🔒 Security & Compliance
- Strict JWT authentication with secure HTTP-only cookies and Bearer tokens.
- Parameterized SQL queries preventing SQL injection vulnerabilities.
- Data encryption in transit (TLS) and AES-256 encryption at rest for sensitive KYC records.
- Strict MIME-type validation and file size restrictions for document uploads.

---

## 📄 License
Proprietary & Confidential - AquaPay Platform. All rights reserved.
