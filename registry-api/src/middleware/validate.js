const HttpError = require('../utils/httpError');

// validate(schema, 'body' | 'params' | 'query') runs a zod schema and returns a clear 400 on failure
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || source,
      message: i.message,
    }));
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid.', details));
  }
  req[source] = result.data;
  next();
};

module.exports = validate;
