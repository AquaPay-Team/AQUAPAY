\# AquaPay



AquaPay is a fintech application focused on digital onboarding, identity verification and KYC management.



The repository is organized into independent frontend and backend applications to support parallel development and easier integration.



\## Project Structure



```text

AQUAPAY/

├── backend/          # Node.js, Express and MySQL API

├── frontend/         # Frontend application

├── .github/          # GitHub Actions and workflows

├── .gitignore

└── README.md

```



\## Applications



\### Backend



The backend provides authentication, user management, KYC verification, document handling and related APIs.



\- Technology: Node.js, Express.js, MySQL and Redis

\- Architecture: MVC with service layer

\- Setup and API documentation: \[Backend README](backend/README.md)



\### Frontend



The frontend application will be maintained separately inside the `frontend/` directory.



\## Development



Backend development instructions, environment configuration, database migrations, API testing and security guidelines are documented in \[backend/README.md](backend/README.md).



\## Team Guidelines



\- Keep frontend and backend code in their respective directories.

\- Agree on API contracts before integrating features.

\- Never commit `.env` files, credentials, tokens or real KYC data.

\- Use parameterized SQL queries.

\- Do not expose password hashes or sensitive KYC information in API responses.

\- Test changes before merging them into `main`.



\## Contribution



1\. Pull the latest changes from `main`.

2\. Work within the appropriate application directory.

3\. Test your changes.

4\. Submit changes through a pull request.



