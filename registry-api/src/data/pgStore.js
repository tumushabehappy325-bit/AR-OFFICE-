/**
 * POSTGRESQL STORE
 * ----------------
 * Same functions and return shapes as memoryStore.js, but the data lives in a real
 * PostgreSQL database (Neon, Supabase, Render, or any other host).
 * Tables are created automatically on startup and the sample accounts are added once.
 */
const { randomUUID } = require('crypto');
const seed = require('./seed');
const { generateSerial } = require('../utils/serial');

const iso = (v) => (v ? new Date(v).toISOString() : null);

const toUser = (r) => r && ({
  id: r.id, username: r.username, name: r.name, role: r.role, program: r.program,
  graduationYear: r.graduation_year, passwordHash: r.password_hash,
});
const toRequest = (r) => r && ({
  id: r.id, studentId: r.student_id, studentName: r.student_name, registrationNumber: r.registration_number,
  documentType: r.document_type, copies: r.copies, deliveryMethod: r.delivery_method, reason: r.reason,
  status: r.status, rejectionReason: r.rejection_reason, reviewedBy: r.reviewed_by, documentSerial: r.document_serial,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const toDocument = (r) => r && ({
  id: r.id, serial: r.serial, requestId: r.request_id, studentId: r.student_id, studentName: r.student_name,
  registrationNumber: r.registration_number, program: r.program, graduationYear: r.graduation_year,
  documentType: r.document_type, issuedBy: r.issued_by, issuedAt: iso(r.issued_at),
});

// camelCase field -> column, used by updateRequest
const REQUEST_COLUMNS = {
  status: 'status', rejectionReason: 'rejection_reason', reviewedBy: 'reviewed_by', documentSerial: 'document_serial',
};

function createPgStore(pool) {
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0] || null;
  const many = async (sql, params) => (await pool.query(sql, params)).rows;

  async function init() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      program TEXT,
      graduation_year INTEGER,
      password_hash TEXT NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      document_type TEXT NOT NULL,
      copies INTEGER NOT NULL,
      delivery_method TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      rejection_reason TEXT,
      reviewed_by TEXT,
      document_serial TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      serial TEXT NOT NULL UNIQUE,
      request_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      program TEXT,
      graduation_year INTEGER,
      document_type TEXT NOT NULL,
      issued_by TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL
    )`);
    const existing = await one('SELECT COUNT(*) AS n FROM users');
    if (Number(existing.n) === 0) {
      for (const u of seed) {
        await pool.query(
          'INSERT INTO users (id, username, name, role, program, graduation_year, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [u.id, u.username, u.name, u.role, u.program, u.graduationYear, u.passwordHash]
        );
      }
    }
  }

  // ---------- Users ----------
  const findUserByUsername = async (username) =>
    toUser(await one('SELECT * FROM users WHERE lower(username) = lower($1)', [username]));
  const findUserById = async (id) => toUser(await one('SELECT * FROM users WHERE id = $1', [id]));

  // ---------- Requests ----------
  async function createRequest(d) {
    const now = new Date().toISOString();
    const row = await one(
      `INSERT INTO requests (id, student_id, student_name, registration_number, document_type, copies, delivery_method,
         reason, status, rejection_reason, reviewed_by, document_serial, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NULL,NULL,NULL,$9,$9) RETURNING *`,
      [randomUUID(), d.studentId, d.studentName, d.registrationNumber, d.documentType, d.copies, d.deliveryMethod, d.reason, now]
    );
    return toRequest(row);
  }
  const findRequestById = async (id) => toRequest(await one('SELECT * FROM requests WHERE id = $1', [id]));

  async function listRequests({ status, studentId } = {}) {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (studentId) { params.push(studentId); where.push(`student_id = $${params.length}`); }
    const sql = `SELECT * FROM requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    return (await many(sql, params)).map(toRequest);
  }
  const findOpenDuplicate = async (studentId, documentType) =>
    toRequest(await one(
      "SELECT * FROM requests WHERE student_id = $1 AND document_type = $2 AND status = 'pending' LIMIT 1",
      [studentId, documentType]
    ));

  async function updateRequest(id, changes) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(changes)) {
      if (!REQUEST_COLUMNS[key]) continue;
      params.push(value);
      sets.push(`${REQUEST_COLUMNS[key]} = $${params.length}`);
    }
    params.push(new Date().toISOString());
    sets.push(`updated_at = $${params.length}`);
    params.push(id);
    return toRequest(await one(`UPDATE requests SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params));
  }

  // ---------- Documents ----------
  async function issueDocumentForRequest(requestId, issuedBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const request = (await client.query('SELECT * FROM requests WHERE id = $1 FOR UPDATE', [requestId])).rows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      if (request.status === 'ready') {
        await client.query('ROLLBACK');
        return { status: 'already_issued', serial: request.document_serial };
      }
      if (request.status !== 'approved') {
        await client.query('ROLLBACK');
        return { status: 'not_approved', requestStatus: request.status };
      }

      const student = (await client.query('SELECT * FROM users WHERE id = $1', [request.student_id])).rows[0];
      if (!student) {
        await client.query('ROLLBACK');
        return { status: 'student_not_found' };
      }

      let row;
      while (!row) {
        const serial = generateSerial();
        row = (await client.query(
          `INSERT INTO documents (id, serial, request_id, student_id, student_name, registration_number, program,
             graduation_year, document_type, issued_by, issued_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (serial) DO NOTHING RETURNING *`,
          [randomUUID(), serial, request.id, student.id, student.name, student.username, student.program,
            student.graduation_year, request.document_type, issuedBy, new Date().toISOString()]
        )).rows[0];
      }
      await client.query(
        "UPDATE requests SET status = 'ready', document_serial = $1, updated_at = $2 WHERE id = $3",
        [row.serial, new Date().toISOString(), request.id]
      );
      await client.query('COMMIT');
      return { status: 'issued', document: toDocument(row) };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  const findDocumentBySerial = async (serial) => toDocument(await one('SELECT * FROM documents WHERE serial = $1', [serial]));
  const listDocuments = async () => (await many('SELECT * FROM documents ORDER BY issued_at DESC')).map(toDocument);

  return {
    mode: 'postgres', init,
    findUserByUsername, findUserById,
    createRequest, findRequestById, listRequests, findOpenDuplicate, updateRequest,
    issueDocumentForRequest, findDocumentBySerial, listDocuments,
  };
}

module.exports = createPgStore;
