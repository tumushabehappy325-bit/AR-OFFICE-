/**
 * IN-MEMORY STORE
 * ---------------
 * Used when DATABASE_URL is not set, so the project runs with zero setup.
 * Data resets whenever the server restarts. See pgStore.js for the live database version.
 */
const { randomUUID } = require('crypto');
const { generateSerial } = require('../utils/serial');

const now = () => new Date().toISOString();

// ---------- Sample data ----------
const users = require('./seed').map((u) => ({ ...u }));

const requests = [];  // transcript / certificate requests
const documents = []; // issued documents (each has a unique serial number)

// ---------- Users ----------
async function findUserByUsername(username) {
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}
async function findUserById(id) {
  return users.find((u) => u.id === id) || null;
}

// ---------- Requests ----------
async function createRequest(data) {
  const request = {
    id: randomUUID(),
    ...data,
    status: 'pending',
    rejectionReason: null,
    reviewedBy: null,
    documentSerial: null,
    createdAt: now(),
    updatedAt: now(),
  };
  requests.push(request);
  return request;
}
async function findRequestById(id) {
  return requests.find((r) => r.id === id) || null;
}
async function listRequests({ status, studentId } = {}) {
  return requests
    .filter((r) => (status ? r.status === status : true))
    .filter((r) => (studentId ? r.studentId === studentId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function findOpenDuplicate(studentId, documentType) {
  return requests.find(
    (r) => r.studentId === studentId && r.documentType === documentType && r.status === 'pending'
  ) || null;
}
async function updateRequest(id, changes) {
  const request = requests.find((r) => r.id === id);
  if (!request) return null;
  Object.assign(request, changes, { updatedAt: now() });
  return request;
}

// ---------- Documents ----------
async function issueDocumentForRequest(requestId, issuedBy) {
  const request = requests.find((r) => r.id === requestId);
  if (!request) return { status: 'not_found' };
  if (request.status === 'ready') return { status: 'already_issued', serial: request.documentSerial };
  if (request.status !== 'approved') return { status: 'not_approved', requestStatus: request.status };
  const student = users.find((u) => u.id === request.studentId);
  if (!student) return { status: 'student_not_found' };

  let serial;
  do { serial = generateSerial(); } while (documents.some((d) => d.serial === serial));
  const doc = {
    id: randomUUID(), serial, requestId: request.id, studentId: student.id, studentName: student.name,
    registrationNumber: student.username, program: student.program, graduationYear: student.graduationYear,
    documentType: request.documentType, issuedBy, issuedAt: now(),
  };
  documents.push(doc);
  Object.assign(request, { status: 'ready', documentSerial: serial, updatedAt: now() });
  return { status: 'issued', document: doc };
}
async function findDocumentBySerial(serial) {
  return documents.find((d) => d.serial === serial) || null;
}
async function listDocuments() {
  return [...documents].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

async function init() {} // nothing to set up for in-memory data

module.exports = {
  mode: 'memory', init,
  findUserByUsername, findUserById,
  createRequest, findRequestById, listRequests, findOpenDuplicate, updateRequest,
  issueDocumentForRequest, findDocumentBySerial, listDocuments,
};
