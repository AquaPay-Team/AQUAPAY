# Fintech KYC Backend

Shared starter structure for the team. Stack: Node.js, Express, MySQL, MVC + service layer.

## Requirements
- Node.js LTS and npm
- MySQL Server
- Git

## Setup
1. Copy `.env.example` to `.env` and fill in your local values. Never commit `.env`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create the database and tables using the SQL files in `database/migrations/`.
4. Start in development:
   ```bash
   npm run dev
   ```

The server starts on `http://localhost:3000`. `GET /api/health` is a basic health check.

## Documentation
- [API Testing Guide](docs/API_TESTING_GUIDE.md): Complete guide for testing all endpoints, headers, cURL commands, and negative scenarios.
- [Codebase Changes Summary](CHANGES_SUMMARY.md): Full summary of schema changes, bug fixes, validation rules, and hierarchy policies.
- [Users Module Documentation](src/modules/users/README.md): Detailed role hierarchy, permissions, and endpoint specifications.

## Architecture
- `routes/`: URL-to-controller mappings
- `controllers/`: HTTP request/response handling
- `services/`: business rules and hierarchy checks
- `models/`: parameterized SQL and data access
- `middlewares/`: authentication, authorization, error handling
- `validators/`: request validation
- `config/`: shared configuration, including database connection
- `database/migrations/`: versioned SQL schema
- `database/seeds/`: development reference data

## Team rules
- Agree on API request/response contracts before parallel implementation.
- Use parameterized queries; never concatenate untrusted input into SQL.
- Never commit `.env`, credentials, tokens, or real KYC data.
- Do not expose public signup that grants the Admin role. Bootstrap the first Admin through a controlled one-time script.
- `created_by` is the account that created a user; `parent_id` is the business hierarchy parent. Keep their meanings distinct.
- Do not return password hashes in API responses.
