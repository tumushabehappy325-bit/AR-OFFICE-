# MUST Registry Document Request and Verification System

Class project for SWE2106 Internet Technologies and Web Design, Etivity 5.

The system supports transcript and other academic-document requests. Students submit requests and track their status. Registry staff review requests and record document issuance. Employers and other verifiers can check an issued document using its serial number.

## Project team

| Full name | Registration number |
|---|---|
| Tumushabe Happy | 2025/BSE/005 |
| Murungi Alex Mugabe | TBD |

## Main functions

- Student sign-in and request submission
- Request status tracking for students
- Staff and administrator review, approval, and rejection
- Issuance record and unique serial number for approved requests
- Public serial-number verification without an employer account
- PostgreSQL data storage through Neon

Issuing a document records that the registry issued it and creates a serial number. The project does not create or store a transcript file; the physical document is prepared and delivered through the registry's process.

## Request workflow

```text
Student submits request
        |
        v
     Pending ---- staff rejects ----> Rejected
        |
     staff approves
        v
     Approved
        |
     staff issues
        v
       Ready + serial number
```

Students can only view their own requests. Staff and administrators can review requests and issue approved documents. A student cannot have two pending requests for the same document type.

## Technology

- Frontend: HTML, CSS, and browser JavaScript
- Backend: Node.js and Express
- Database: PostgreSQL, hosted on Neon
- Validation: Zod
- Authentication: JSON Web Tokens (JWT)
- Password hashing for accounts created through the user-management script: bcrypt
- API documentation and manual requests: Postman collection

The browser sends requests to the Express API. The API reads and writes database records; the browser does not connect directly to Neon.

## Requirements

- Node.js and npm
- A PostgreSQL database, such as Neon, for persistent data

## Setup

From the project directory:

```bash
npm install
cp .env.example .env
```

Set `JWT_SECRET` to a long, private random value in `.env`. To use Neon, set `DATABASE_URL` to the connection string for the intended Neon branch and database. Keep `.env` private and do not commit it.

Start the application:

```bash
npm start
```

Open <http://localhost:3000>. The startup message reports whether the application is using PostgreSQL or in-memory data. In-memory data resets when the server restarts; PostgreSQL data persists.

For automatic restarts during development:

```bash
npm run dev
```

## Environment variables

Copy `.env.example` to `.env` and adjust the values for your environment. Never commit `.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `3000` | Port the Express server listens on |
| `JWT_SECRET` | Yes in production | `dev-secret-change-me` | Secret used to sign and verify JWTs. Use a long, random, private value. Changing it invalidates existing tokens. |
| `JWT_EXPIRES_IN` | No | `2h` | How long an issued token remains valid |
| `DATABASE_URL` | No | empty | PostgreSQL connection string. Leave empty to use the in-memory store. |
| `USE_PGMEM` | No | unset | Test-only. Set to `true` to use an in-memory PostgreSQL implementation. |

When `DATABASE_URL` is empty, the application uses in-memory data that is lost on restart. Provide a Neon connection string (including the SSL settings Neon gives you) to persist data.

## Adding or resetting a user

The script uses `DATABASE_URL` from `.env`. New passwords must be at least eight characters and are stored as bcrypt hashes.

Add a staff account:

```bash
node Scripts/add-user.js add "staff@example.edu" "Staff Name" staff "replace-with-a-private-password"
```

Add a student account with program and graduation year:

```bash
node Scripts/add-user.js add "2024/BCS/101" "Student Name" student "replace-with-a-private-password" "BSc Computer Science" 2027
```

Reset a password:

```bash
node Scripts/add-user.js reset "staff@example.edu" "replace-with-a-private-password"
```

Avoid sharing passwords or placing real credentials in project documentation.

## API endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Check that the API is running |
| POST | `/api/auth/login` | Public | Authenticate and receive a JWT |
| POST | `/api/requests` | Student | Submit a document request |
| GET | `/api/requests/mine` | Student | List the signed-in student's requests |
| GET | `/api/requests?status=pending` | Staff, administrator | List requests, optionally filtered by status |
| GET | `/api/requests/:id` | Owner, staff, administrator | View one request |
| PATCH | `/api/requests/:id/status` | Staff, administrator | Approve or reject a pending request |
| POST | `/api/documents` | Staff, administrator | Record issuance for an approved request |
| GET | `/api/documents` | Staff, administrator | List issued-document records |
| GET | `/api/verify/:serial` | Public | Verify an issued-document record |

Protected endpoints require `Authorization: Bearer <token>`.

## Validation and status rules

- Supported document types: `official_transcript`, `certificate_copy`, `verification_letter`
- Supported delivery methods: `pickup`, `email`, `courier`
- Copies must be a whole number from 1 to 5.
- A request reason must contain 5 to 200 characters.
- Rejection requires a reason.
- Only pending requests can be reviewed.
- Only approved requests can be issued.
- Serial numbers use the format `MUST-TR-YYYY-XXXXXX`.

## Testing with Postman

Import `postman/registry-api.postman_collection.json` into Postman. Set the `baseUrl` collection variable to `http://localhost:3000`, start the API, and run the requests in order. The collection demonstrates authentication, validation, access control, request review, issuance, and verification.

The API test command is:

```bash
npm run test:api
```

The collection uses the sample credentials defined for the project. If the connected database contains different user records or passwords, update the collection's login requests to match that database.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| Data disappears after restarting the server | `DATABASE_URL` is empty, so the in-memory store is used. Set it to a PostgreSQL connection string to persist data. |
| `Could not start. Database setup failed:` | The database is unreachable or `DATABASE_URL` is malformed. Check the connection string and include the SSL options Neon requires. |
| `EADDRINUSE` when starting | Another process is using the configured port. Stop it or set a different `PORT` in `.env`. |
| `401 Missing or malformed Authorization header` | Protected requests need `Authorization: Bearer <token>`. Log in again and copy the returned token. |
| `401 Token is invalid or has expired` | Log in again. If `JWT_SECRET` changed, all previously issued tokens are invalid. |
| `403 FORBIDDEN` | The signed-in account does not have the required role. Use a student, staff, or administrator account as appropriate. |
| `npm run test:api` cannot connect | Start the API first, then run `npm install` so Newman is available and confirm the collection's sample credentials match your database. |
| Login works but no sample data appears | The in-memory store starts from its seed data. Add users with `Scripts/add-user.js` or connect a populated PostgreSQL database. |
| `.env` values are ignored | Run the commands from the `registry-api` directory so `dotenv` can find `.env`, and confirm the file is named `.env`, not `.env.txt`. |

## Project structure

```text
src/
  app.js                 Express routes and static frontend
  server.js              Startup and database initialization
  config.js              Environment configuration
  schemas.js             Request validation schemas
  routes/                Authentication, requests, documents, verification
  middleware/            Authentication, validation, error handling
  data/                  PostgreSQL, in-memory store, and sample users
  utils/                 Serial generation and HTTP errors
frontend/                HTML, CSS, and browser JavaScript
Scripts/                 User creation and password reset utility
postman/                 API collection and collection builder
```

## Project scope

This class project demonstrates an academic-document request workflow, role-based API access, persistent records, and public serial verification. It records document issuance but does not generate transcript files, deliver documents, or integrate with a university student information system.
