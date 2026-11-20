# AquaPay Frontend Manual Regression Checklist

Run this checklist at the end of every refactoring phase.

## 1. Authentication & Session
- [ ] **Admin Login**: Log in with an admin account (`admin@gmail.com`). Verify redirection to `/admin`.
- [ ] **User Login**: Log in with a user account. Verify redirection to `/dashboard` (or `/kyc` if unverified).
- [ ] **Logout (Admin)**: Click logout from Admin Header/Sidebar. Verify session is wiped and redirects to `/login`.
- [ ] **Logout (User)**: Click logout from User Sidebar. Verify session is wiped and redirects to `/login`.
- [ ] **Refresh State**: Refresh browser on `/admin` and `/dashboard`. Verify user remains logged in without infinite loaders.

## 2. KYC Onboarding Flow (Merchant)
- [ ] **Initial Landing**: Login with an unverified user. Verify redirect to `/kyc`.
- [ ] **Step 1 (Basic Details)**: Submit details, trigger OTP, enter OTP, verify advance to Step 2.
- [ ] **Step 2 (DigiLocker / Aadhaar)**: Open DigiLocker popup, check message listener, confirm completion and return to app.
- [ ] **Step 3 (PAN Verification)**: Enter PAN, verify validation, confirm successful check.
- [ ] **Step 4 (Bank Details)**: Enter account and IFSC, verify penny-drop verification.
- [ ] **Step 5 (Media Uploads)**: Upload Aadhaar, PAN images, and record video. Confirm upload progress.
- [ ] **Step 6 (Agreements)**: View agreement text, accept checkbox, and advance.
- [ ] **Step 7 (Review & Submit)**: Review submitted summary, verify final submission. Confirm UI transitions to "Under Review / Submitted".

## 3. Admin KYC Review
- [ ] **View KYC Queue**: Navigate to `/admin/kyc`. Check pending KYC cases table.
- [ ] **Approve KYC**: Approve a pending case. Verify status updates to "Approved".
- [ ] **Reject KYC**: Reject a pending case with notes. Verify merchant gets reset to Steps 5–7.

## 4. User & Hierarchy Management
- [ ] **Admin User Directory**: Browse `/admin/users`. Filter by role tab / dropdown.
- [ ] **Create User**: Open create user modal, submit new downline user, verify list updates.