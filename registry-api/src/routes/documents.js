const express = require('express');
const store = require('../data/store');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const HttpError = require('../utils/httpError');
const { generateSerial } = require('../utils/serial');
const { issueDocumentSchema } = require('../schemas');

const router = express.Router();
router.use(authenticate, requireRole('staff', 'admin'));

// POST /api/documents  (staff, admin) - issue a document for an approved request
router.post('/', validate(issueDocumentSchema), async (req, res, next) => {
  try {
    const request = await store.findRequestById(req.body.requestId);
    if (!request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'No request found with that id.');
    if (request.status === 'ready') {
      throw new HttpError(409, 'ALREADY_ISSUED', `A document was already issued for this request (${request.documentSerial}).`);
    }
    if (request.status !== 'approved') {
      throw new HttpError(409, 'REQUEST_NOT_APPROVED', `Only approved requests can be issued. This request is ${request.status}.`);
    }
    const student = await store.findUserById(request.studentId);

    // Make sure the serial is unique
    let serial = generateSerial();
    while (await store.findDocumentBySerial(serial)) serial = generateSerial();

    const doc = await store.createDocument({
      serial,
      requestId: request.id,
      studentId: student.id,
      studentName: student.name,
      registrationNumber: student.username,
      program: student.program,
      graduationYear: student.graduationYear,
      documentType: request.documentType,
      issuedBy: req.user.name,
    });
    await store.updateRequest(request.id, { status: 'ready', documentSerial: serial });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
});

// GET /api/documents  (staff, admin) - list issued documents
router.get('/', async (req, res, next) => {
  try {
    const list = await store.listDocuments();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) { next(err); }
});

module.exports = router;
