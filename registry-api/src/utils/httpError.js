// Small helper so controllers can throw errors with a status code and a machine-readable code.
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
module.exports = HttpError;
