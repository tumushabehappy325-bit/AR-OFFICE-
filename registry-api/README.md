# Registry API: Transcript Request and Document Verification

SWE2106 Internet Technologies and Web Design, Etivity 5.
A REST API for the Academic Registrar at Mbarara University of Science and Technology. Students request transcripts, registry staff review and issue them, and anyone can verify a document using its serial number.

## Setup

```bash
git clone <your-repo-url>
cd registry-api
npm install
cp .env.example .env      # then set JWT_SECRET to a long random string
npm start                 # http://localhost:3000
```

Use `npm run dev` to restart automatically when you save a file.

## Run the automated API tests

With the server running in one terminal, run this in another:

```bash
npm run test:api
```

This runs the whole Postman collection (38 requests, 81 checks) from the command line.

## Postman

1. In Postman choose **Import** and select `postman/registry-api.postman_collection.json`.
2. Start the server, then run the folders in order (0 to 4), or use the Collection Runner.
3. Tokens and ids are saved automatically as collection variables. Change `baseUrl` if the API is deployed.

## Sample accounts

| Role | Username | Password |
|---|---|---|
| Student | 2021/BSE/045 | Student@123 |
| Student 2 | 2021/BIT/012 | Student@123 |
| Staff (registry officer) | officer@must.ac.ug | Staff@123 |
| Admin (registrar) | registrar@must.ac.ug | Admin@123 |

## Endpoints

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Check the server is running |
| POST | `/api/auth/login` | Public | Log in, returns a JWT |
| POST | `/api/requests` | Student | Submit a request |
| GET | `/api/requests/mine` | Student | View own requests |
| GET | `/api/requests?status=` | Staff, admin | List all requests, optional status filter |
| GET | `/api/requests/:id` | Owner, staff, admin | View one request |
| PATCH | `/api/requests/:id/status` | Staff, admin | Approve, or reject with a reason |
| POST | `/api/documents` | Staff, admin | Issue a document for an approved request |
| GET | `/api/documents` | Staff, admin | List issued documents |
| GET | `/api/verify/:serial` | Public | Check whether a document is genuine |

Protected routes need the header `Authorization: Bearer <token>`.

### Request lifecycle

`pending` then `approved` or `rejected`. When staff issue a document for an approved request it becomes `ready` and gets a serial number such as `MUST-TR-2026-A7K93Q`.

### Example request body (POST /api/requests)

```json
{
  "documentType": "official_transcript",
  "copies": 2,
  "deliveryMethod": "pickup",
  "reason": "Needed for a job application"
}
```

`documentType`: `official_transcript`, `certificate_copy`, `verification_letter`
`deliveryMethod`: `pickup`, `email`, `courier`

### Response format

Success: `{ "success": true, "data": { ... } }`
Error: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }`

| Status | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Invalid input (details list each field) |
| 401 | Missing, invalid, or expired token, or wrong login |
| 403 | Logged in but not allowed (wrong role or someone else's request) |
| 404 | Request, document, or route not found |
| 409 | Conflict (duplicate request, wrong status change, already issued) |

## Validation rules

- `copies` is a whole number from 1 to 5
- `documentType` and `deliveryMethod` must be from the allowed lists
- `reason` is 5 to 200 characters
- Rejecting a request requires a reason
- A student cannot have two pending requests of the same type
- Only pending requests can be reviewed, and only approved requests can be issued
- Students can only view their own requests
- Serial numbers must match the format `MUST-TR-YYYY-XXXXXX`

## Project structure

```
src/
  app.js, server.js, config.js       App setup and startup
  data/store.js                      Chooses the data source (PostgreSQL or in-memory)
  data/pgStore.js                    PostgreSQL version (live database)
  data/memoryStore.js                In-memory version (no setup)
  data/seed.js                       Sample accounts
  middleware/auth.js                 JWT check and role guard
  middleware/validate.js             Input validation runner
  middleware/errorHandler.js         Consistent error responses
  routes/auth.js                     Login
  routes/requests.js                 Student requests and staff review
  routes/documents.js                Issuing documents
  routes/verify.js                   Public verification
  schemas.js                         Validation rules (zod)
frontend/                            Web interface (HTML, CSS, JavaScript)
postman/                             Postman collection and the script that builds it
```

## Connecting a live database (PostgreSQL)

By default the API keeps data in memory, so it runs with no setup and resets when the server restarts. To use a live database, set `DATABASE_URL` in `.env` to a PostgreSQL connection string and restart:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

The tables are created automatically on startup and the sample accounts are added once. The startup message shows which mode is active, for example `data: postgres`.

Free hosted PostgreSQL options: **Neon** (neon.tech), **Supabase** (supabase.com), or **Render** (render.com). Create a project, copy the connection string, and paste it into `.env`. Never commit `.env` to GitHub.

## Frontend

The web interface is in `frontend/` and is served by the same Express server, so there is nothing extra to run. After `npm start`, open http://localhost:3000.

- **Log in** as a demo account (buttons on the login page fill the details in).
- **Student:** submit a request and follow its status.
- **Registry officer or registrar:** approve or reject requests, issue documents, see issued documents.
- **Verify a document:** public page, no login. Try a real serial from an issued document, then a fake one.

## Deploying (optional)

On Render (or Railway), create a Web Service from the GitHub repo with build command `npm install` and start command `npm start`. Add the environment variables `JWT_SECRET` and `DATABASE_URL`. Then set the Postman `baseUrl` variable to the deployed address.

## Demo script (for the presentation)

1. Login as student, then as staff (Postman folder 1).
2. Student submits a request, then submit invalid ones (bad copies, unknown type) to show validation.
3. Show a student cannot use staff routes (403) or view another student's request (403).
4. Staff approves, then issues a document and gets a serial number.
5. Verify the serial with no login, then verify a fake serial and a malformed one.
6. Show the same flow in the web interface (login, request, approve, issue, verify), and mention the data is stored in PostgreSQL.
