const logger = require('../utils/logger');
const { error: sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error: ${err && err.message ? err.message : String(err)}`);
  const payload = {
    code: err && err.code ? err.code : 'INTERNAL_ERROR',
    message: err && err.message ? err.message : 'Internal server error'
  };
  return sendError(res, payload, err && err.status ? err.status : 500);
}

module.exports = errorHandler;
