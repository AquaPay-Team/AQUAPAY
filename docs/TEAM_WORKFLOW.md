# Team Workflow

1. Clone the shared repository; use the same Node.js version and `npm install`.
2. Copy `.env.example` to `.env` and set local credentials. Never commit `.env`.
3. Database owner maintains migrations and seed scripts.
4. Each API owner works on a feature branch and follows `docs/API_CONTRACT.md`.
5. Use parameterized SQL; do not return password hashes; don't commit secrets or real KYC data.
6. Open a pull request and test with shared Postman requests before merging.
7. Initial milestone: database migration works, a controlled Admin bootstrap is available, login works, and Admin can create a Sub Admin.
