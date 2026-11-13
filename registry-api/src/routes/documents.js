const express = require('express');
const store = require('../data/store');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const HttpError = require('../utils/httpError');
const { issueDocumentSchema } = require('../schemas');

const router = express.Router();
router.use(authenticate, requireRole('staff', 'admin'));

// POST /api/documents  (staff, admin) - issue a document for an approved request
router.post('/', validate(issueDocumentSchema), async (req, res, next) => {
  try {
    // The store creates the serial and marks the request ready as one operation.
    const result = await store.issueDocumentForRequest(req.body.requestId, req.user.name);
    if (result.status === 'not_found') throw new HttpError(404, 'REQUEST_NOT_FOUND', 'No request found with that id.');
    if (result.status === 'already_issued') {
      throw new HttpError(409, 'ALREADY_ISSUED', `A document was already issued for this request (${result.serial}).`);
    }
    if (result.status === 'not_approved') {
      throw new HttpError(409, 'REQUEST_NOT_APPROVED', `Only approved requests can be issued. This request is ${result.requestStatus}.`);
    }
    if (result.status === 'student_not_found') {
      throw new HttpError(404, 'STUDENT_NOT_FOUND', 'The student account for this request no longer exists.');
    }
    res.status(201).json({ success: true, data: result.document });
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
