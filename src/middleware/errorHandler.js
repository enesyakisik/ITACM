const { HttpError } = require('../utils/httpError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFoundHandler };
