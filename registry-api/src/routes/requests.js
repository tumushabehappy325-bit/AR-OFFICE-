const express = require('express');
const store = require('../data/store');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const HttpError = require('../utils/httpError');
const { createRequestSchema, idParamSchema, listQuerySchema, reviewSchema } = require('../schemas');

const router = express.Router();
router.use(authenticate);

// POST /api/requests  (student) - submit a new request
router.post('/', requireRole('student'), validate(createRequestSchema), async (req, res, next) => {
  try {
    const duplicate = await store.findOpenDuplicate(req.user.id, req.body.documentType);
    if (duplicate) {
      throw new HttpError(409, 'DUPLICATE_REQUEST', 'You already have a pending request for this document type.');
    }
    const request = await store.createRequest({
      studentId: req.user.id,
      studentName: req.user.name,
      registrationNumber: req.user.username,
      ...req.body,
    });
    res.status(201).json({ success: true, data: request });
  } catch (err) { next(err); }
});

// GET /api/requests/mine  (student) - own requests
router.get('/mine', requireRole('student'), async (req, res, next) => {
  try {
    const list = await store.listRequests({ studentId: req.user.id });
    res.json({ success: true, count: list.length, data: list });
  } catch (err) { next(err); }
});

// GET /api/requests?status=pending  (staff, admin) - all requests
router.get('/', requireRole('staff', 'admin'), validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const list = await store.listRequests({ status: req.query.status });
    res.json({ success: true, count: list.length, data: list });
  } catch (err) { next(err); }
});

// GET /api/requests/:id  (owner student, staff, admin)
router.get('/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const request = await store.findRequestById(req.params.id);
    if (!request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'No request found with that id.');
    if (req.user.role === 'student' && request.studentId !== req.user.id) {
      throw new HttpError(403, 'FORBIDDEN', 'You can only view your own requests.');
    }
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
});

// PATCH /api/requests/:id/status  (staff, admin) - approve or reject a pending request
router.patch('/:id/status', requireRole('staff', 'admin'),
  validate(idParamSchema, 'params'), validate(reviewSchema), async (req, res, next) => {
  try {
    const request = await store.findRequestById(req.params.id);
    if (!request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'No request found with that id.');
    if (request.status !== 'pending') {
      throw new HttpError(409, 'INVALID_STATUS_CHANGE', `Only pending requests can be reviewed. This request is already ${request.status}.`);
    }
    const updated = await store.updateRequest(request.id, {
      status: req.body.status,
      rejectionReason: req.body.status === 'rejected' ? req.body.reason : null,
      reviewedBy: req.user.name,
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
