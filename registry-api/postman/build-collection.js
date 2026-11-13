// Generates postman/registry-api.postman_collection.json
// Run with: npm run postman:build
const fs = require('fs');
const path = require('path');

// Build one reusable request definition with optional auth, body, query, and checks.
const item = (name, method, urlPath, { token, body, tests = [], description = '', query } = {}) => {
  const header = [];
  if (body !== undefined) header.push({ key: 'Content-Type', value: 'application/json' });
  if (token) header.push({ key: 'Authorization', value: `Bearer {{${token}}}` });

  const url = {
    raw: `{{baseUrl}}${urlPath}${query ? '?' + query : ''}`,
    host: ['{{baseUrl}}'],
    path: urlPath.split('/').filter(Boolean),
  };
  if (query) {
    url.query = query.split('&').map((q) => { const [key, value] = q.split('='); return { key, value }; });
  }

  return {
    name,
    request: {
      method,
      header,
      ...(body !== undefined ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}),
      url,
      description,
    },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }],
  };
};

const status = (code) => `pm.test("Status code is ${code}", () => pm.response.to.have.status(${code}));`;
const errorCode = (code) => `pm.test("Error code is ${code}", () => pm.expect(pm.response.json().error.code).to.eql("${code}"));`;
const success = (flag) => `pm.test("success is ${flag}", () => pm.expect(pm.response.json().success).to.eql(${flag}));`;
const save = (variable, expr) => `pm.collectionVariables.set("${variable}", ${expr});`;

const validRequest = { documentType: 'official_transcript', deliveryMethod: 'pickup', reason: 'Needed for a job application' };

// Keep the collection in workflow order so the runner can reuse saved tokens and ids.
const collection = {
  info: {
    name: 'Registry API: Transcript Request and Document Verification',
    description:
      'SWE2106 Etivity 5. Test collection for the MUST Academic Registrar transcript request and document verification API.\n\n' +
      'HOW TO USE\n1. Start the server (npm start).\n2. Run the folders in order (or use the Collection Runner). Tokens and ids are saved automatically as collection variables.\n3. Change the baseUrl variable if the API is deployed.\n\n' +
      'SAMPLE ACCOUNTS\nStudent: 2021/BSE/045 / Student@123\nStudent 2: 2021/BIT/012 / bit2024\nStaff: officer@must.ac.ug / Staff@123\nAdmin: registrar@must.ac.ug / Admin@123',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'studentToken', value: '' },
    { key: 'student2Token', value: '' },
    { key: 'staffToken', value: '' },
    { key: 'requestId', value: '' },
    { key: 'request2Id', value: '' },
    { key: 'serial', value: '' },
  ],
  item: [
    {
      name: '0. Health',
      item: [
        item('Health check', 'GET', '/api/health', { tests: [status(200), success(true)] }),
      ],
    },
    {
      name: '1. Auth',
      item: [
        item('Login student (valid)', 'POST', '/api/auth/login', {
          body: { username: '2021/BSE/045', password: 'Student@123' },
          description: 'Students log in with their registration number. Saves studentToken.',
          tests: [status(200), success(true),
            'pm.test("Returns a token and role student", () => { const d = pm.response.json().data; pm.expect(d.token).to.be.a("string"); pm.expect(d.user.role).to.eql("student"); });',
            save('studentToken', 'pm.response.json().data.token')],
        }),
        item('Login second student (valid)', 'POST', '/api/auth/login', {
          body: { username: '2021/BIT/012', password: 'bit2024' },
          description: 'Used later to prove one student cannot see another student\'s request. Saves student2Token.',
          tests: [status(200), save('student2Token', 'pm.response.json().data.token')],
        }),
        item('Login staff (valid)', 'POST', '/api/auth/login', {
          body: { username: 'officer@must.ac.ug', password: 'Staff@123' },
          description: 'Registry officer. Saves staffToken.',
          tests: [status(200),
            'pm.test("Role is staff", () => pm.expect(pm.response.json().data.user.role).to.eql("staff"));',
            save('staffToken', 'pm.response.json().data.token')],
        }),
        item('Login with wrong password (invalid)', 'POST', '/api/auth/login', {
          body: { username: '2021/BSE/045', password: 'wrong-password' },
          tests: [status(401), success(false), errorCode('INVALID_CREDENTIALS')],
        }),
        item('Login with missing password (invalid)', 'POST', '/api/auth/login', {
          body: { username: '2021/BSE/045' },
          tests: [status(400), errorCode('VALIDATION_ERROR'),
            'pm.test("Details name the password field", () => pm.expect(pm.response.json().error.details[0].field).to.eql("password"));'],
        }),
      ],
    },
    {
      name: '2. Student',
      item: [
        item('Submit transcript request (valid)', 'POST', '/api/requests', {
          token: 'studentToken', body: validRequest,
          description: 'Creates a request with status pending. Saves requestId.',
          tests: [status(201), success(true),
            'pm.test("Status is pending", () => pm.expect(pm.response.json().data.status).to.eql("pending"));',
            save('requestId', 'pm.response.json().data.id')],
        }),
        item('Submit request with unknown documentType (invalid)', 'POST', '/api/requests', {
          token: 'studentToken', body: { ...validRequest, documentType: 'passport' },
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Submit request with missing reason (invalid)', 'POST', '/api/requests', {
          token: 'studentToken', body: { documentType: 'official_transcript', deliveryMethod: 'email' },
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Submit request without a token (invalid)', 'POST', '/api/requests', {
          body: validRequest,
          tests: [status(401), errorCode('UNAUTHENTICATED')],
        }),
        item('Submit duplicate pending request (invalid)', 'POST', '/api/requests', {
          token: 'studentToken', body: validRequest,
          description: 'The student already has a pending official_transcript request.',
          tests: [status(409), errorCode('DUPLICATE_REQUEST')],
        }),
        item('Staff tries to submit a request (invalid role)', 'POST', '/api/requests', {
          token: 'staffToken', body: validRequest,
          tests: [status(403), errorCode('FORBIDDEN')],
        }),
        item('View my requests', 'GET', '/api/requests/mine', {
          token: 'studentToken',
          tests: [status(200),
            'pm.test("List contains the new request", () => pm.expect(pm.response.json().data.map(r => r.id)).to.include(pm.collectionVariables.get("requestId")));'],
        }),
        item('View one of my requests by id', 'GET', '/api/requests/{{requestId}}', {
          token: 'studentToken',
          tests: [status(200), 'pm.test("Id matches", () => pm.expect(pm.response.json().data.id).to.eql(pm.collectionVariables.get("requestId")));'],
        }),
        item("Another student views my request (invalid)", 'GET', '/api/requests/{{requestId}}', {
          token: 'student2Token',
          tests: [status(403), errorCode('FORBIDDEN')],
        }),
        item('Request id is not a valid id (invalid)', 'GET', '/api/requests/not-a-real-id', {
          token: 'studentToken',
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Request id does not exist (invalid)', 'GET', '/api/requests/00000000-0000-4000-8000-000000000000', {
          token: 'studentToken',
          tests: [status(404), errorCode('REQUEST_NOT_FOUND')],
        }),
      ],
    },
    {
      name: '3. Staff',
      item: [
        item('Student tries to list all requests (invalid role)', 'GET', '/api/requests', {
          token: 'studentToken',
          tests: [status(403), errorCode('FORBIDDEN')],
        }),
        item('List pending requests', 'GET', '/api/requests', {
          token: 'staffToken', query: 'status=pending',
          tests: [status(200),
            'pm.test("Every item is pending", () => pm.response.json().data.forEach(r => pm.expect(r.status).to.eql("pending")));'],
        }),
        item('List with unknown status filter (invalid)', 'GET', '/api/requests', {
          token: 'staffToken', query: 'status=archived',
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Issue document before approval (invalid)', 'POST', '/api/documents', {
          token: 'staffToken', body: { requestId: '{{requestId}}' },
          tests: [status(409), errorCode('REQUEST_NOT_APPROVED')],
        }),
        item('Reject without a reason (invalid)', 'PATCH', '/api/requests/{{requestId}}/status', {
          token: 'staffToken', body: { status: 'rejected' },
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Set an unknown status (invalid)', 'PATCH', '/api/requests/{{requestId}}/status', {
          token: 'staffToken', body: { status: 'done' },
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Approve request', 'PATCH', '/api/requests/{{requestId}}/status', {
          token: 'staffToken', body: { status: 'approved' },
          tests: [status(200), 'pm.test("Status is approved", () => pm.expect(pm.response.json().data.status).to.eql("approved"));'],
        }),
        item('Approve the same request again (invalid)', 'PATCH', '/api/requests/{{requestId}}/status', {
          token: 'staffToken', body: { status: 'approved' },
          tests: [status(409), errorCode('INVALID_STATUS_CHANGE')],
        }),
        item('Issue document for approved request', 'POST', '/api/documents', {
          token: 'staffToken', body: { requestId: '{{requestId}}' },
          description: 'Generates a unique serial number and marks the request ready. Saves serial.',
          tests: [status(201), success(true),
            'pm.test("Serial has the expected format", () => pm.expect(pm.response.json().data.serial).to.match(/^MUST-TR-\\d{4}-[A-Z0-9]{6}$/));',
            save('serial', 'pm.response.json().data.serial')],
        }),
        item('Issue document twice (invalid)', 'POST', '/api/documents', {
          token: 'staffToken', body: { requestId: '{{requestId}}' },
          tests: [status(409), errorCode('ALREADY_ISSUED')],
        }),
        item('Student tries to issue a document (invalid role)', 'POST', '/api/documents', {
          token: 'studentToken', body: { requestId: '{{requestId}}' },
          tests: [status(403), errorCode('FORBIDDEN')],
        }),
        item('List issued documents', 'GET', '/api/documents', {
          token: 'staffToken',
          tests: [status(200), 'pm.test("Contains the issued serial", () => pm.expect(pm.response.json().data.map(d => d.serial)).to.include(pm.collectionVariables.get("serial")));'],
        }),
        item('Student sees request is ready', 'GET', '/api/requests/{{requestId}}', {
          token: 'studentToken',
          tests: [status(200), 'pm.test("Status is ready with the serial attached", () => { const d = pm.response.json().data; pm.expect(d.status).to.eql("ready"); pm.expect(d.documentSerial).to.eql(pm.collectionVariables.get("serial")); });'],
        }),
        item('Second student submits a request', 'POST', '/api/requests', {
          token: 'student2Token', body: { documentType: 'certificate_copy', deliveryMethod: 'email', reason: 'Replacement for lost certificate' },
          description: 'Saves request2Id, used to demonstrate rejection.',
          tests: [status(201), save('request2Id', 'pm.response.json().data.id')],
        }),
        item('Reject request with a reason', 'PATCH', '/api/requests/{{request2Id}}/status', {
          token: 'staffToken', body: { status: 'rejected', reason: 'Outstanding fees not cleared' },
          tests: [status(200),
            'pm.test("Rejected with the reason stored", () => { const d = pm.response.json().data; pm.expect(d.status).to.eql("rejected"); pm.expect(d.rejectionReason).to.eql("Outstanding fees not cleared"); });'],
        }),
        item('Issue document for a rejected request (invalid)', 'POST', '/api/documents', {
          token: 'staffToken', body: { requestId: '{{request2Id}}' },
          tests: [status(409), errorCode('REQUEST_NOT_APPROVED')],
        }),
      ],
    },
    {
      name: '4. Public verification (no login)',
      item: [
        item('Verify a genuine serial', 'GET', '/api/verify/{{serial}}', {
          description: 'No Authorization header. Employers and other institutions use this.',
          tests: [status(200),
            'pm.test("valid is true and details are returned", () => { const j = pm.response.json(); pm.expect(j.valid).to.eql(true); pm.expect(j.data.studentName).to.eql("Akello Grace"); });',
            'pm.test("Internal ids are not exposed", () => pm.expect(pm.response.json().data).to.not.have.property("studentId"));'],
        }),
        item('Verify a forged serial (well formed but not issued)', 'GET', '/api/verify/MUST-TR-2026-ZZZZZZ', {
          tests: [status(404),
            'pm.test("valid is false", () => pm.expect(pm.response.json().valid).to.eql(false));',
            errorCode('DOCUMENT_NOT_FOUND')],
        }),
        item('Verify a malformed serial (invalid)', 'GET', '/api/verify/12345', {
          tests: [status(400), errorCode('VALIDATION_ERROR')],
        }),
        item('Unknown route', 'GET', '/api/nothing-here', {
          tests: [status(404), errorCode('ROUTE_NOT_FOUND')],
        }),
      ],
    },
  ],
};

const out = path.join(__dirname, 'registry-api.postman_collection.json');
// Regenerate the checked-in collection from this source file after editing requests.
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log('Wrote', out);
