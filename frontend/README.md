# AquaPay - Frontend Merchant & Partner Portal

AquaPay Frontend is a high-performance, responsive React 19 application built with Vite and Tailwind CSS. It powers both the Merchant Counter Terminal (Retailers & Distributors) and the Super Admin Compliance Dashboard.

---

## 🌟 Features

- **Modern Merchant Dashboard:**
  - Multi-wallet overview (Main Wallet, Settlement Wallet, UPI Wallet)
  - Core banking services: Payout, Credit Card Bill 2, Rupay UPI Collection, Add Money
  - Real-time business metrics counter (Today Business, This Month, Last Month, This Year)
  - Full-featured transaction ledger with date-range filters, live search, export, and pagination
  - Top navigation with search shortcut (`Ctrl + K`), balance quick-pill, and notification popover

- **7-Step RBI-Compliant Digital KYC:**
  - OTP verification (Mobile & Email)
  - Aadhaar eKYC via DigiLocker with automated popup window communication
  - PAN verification with legal name matching
  - Bank account Penny Drop verification
  - Media asset uploads (Shop photo, live selfie, video consent with WebM/MP4 support)
  - Legal digital agreement review, checkbox confirmation, and PDF download
  - Real-time application status tracking

- **8-Tier Role Hierarchy & Navigation:**
  - Dynamic navigation adapts based on logged-in user role (Retailer, Distributor, MD, CNF, State Head, NSM, Sub-Admin, Admin)
  - Built-in child agent onboarding modal for authorized distributor tiers

---

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Bundler:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/) (Stroke width 2.25 minimalist line icons)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **Toasts:** [Sonner](https://sonner.emilkowal.ski/)
- **PDF Generation:** [jsPDF](https://github.com/parallax/jsPDF) & [html2canvas](https://html2canvas.hertzen.com/)

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:5173`.

### Production Build
```bash
npm run build
```

---

## 📂 Project Structure

```text
src/
├── api/             # Backend API service integrations
├── assets/          # Static assets & brand media
├── components/      # Common & layout components (Header, Sidebar)
├── config/          # Centralized role navigation & configs
├── constants/       # Role metadata, statuses, and options
├── features/        # Feature-specific modules (KYC, Admin, Modals)
├── layouts/         # UserLayout & AdminLayout wrappers
├── pages/           # Application views (Dashboard, KYC, Auth, Profile)
└── styles/          # Global styles and Tailwind configuration
```

---

## 📄 License
Proprietary & Confidential - AquaPay Platform. All rights reserved.
