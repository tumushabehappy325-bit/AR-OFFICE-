const express = require('express');
const store = require('../data/store');
const validate = require('../middleware/validate');
const { serialParamSchema } = require('../schemas');

const router = express.Router();

// GET /api/verify/:serial  (PUBLIC, no login)
// Employers and other institutions use this to check a document is genuine.
router.get('/:serial', validate(serialParamSchema, 'params'), async (req, res, next) => {
  try {
    const doc = await store.findDocumentBySerial(req.params.serial);
    if (!doc) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'No document matches this serial number. It may be forged.' },
      });
    }
    // Only share what a verifier needs, never internal ids
    res.json({
      success: true,
      valid: true,
      data: {
        serial: doc.serial,
        studentName: doc.studentName,
        registrationNumber: doc.registrationNumber,
        program: doc.program,
        graduationYear: doc.graduationYear,
        documentType: doc.documentType,
        issuedAt: doc.issuedAt,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
