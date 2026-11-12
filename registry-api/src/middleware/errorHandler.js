const HttpError = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

// Map known application errors to their status; hide unexpected server details from clients.
// Every error leaves the API in the same shape: { success: false, error: { code, message, details? } }
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err instanceof HttpError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ success: false, error });
  }
  console.error(err);
  res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Something went wrong on the server.' } });
}

module.exports = { notFound, errorHandler };
