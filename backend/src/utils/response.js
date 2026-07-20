/**
 * Standardized response helpers
 */
function success(res, data = {}, status = 200) {
  const payload = Object.assign({ success: true }, data);
  return res.status(status).json(payload);
}

function error(res, errorObj = { code: 'INTERNAL_ERROR', message: 'An error occurred' }, status = 500) {
  const payload = {
    success: false,
    error: {
      code: errorObj.code || 'INTERNAL_ERROR',
      message: errorObj.message || String(errorObj)
    }
  };
  return res.status(status).json(payload);
}

module.exports = {
  success,
  error
};
