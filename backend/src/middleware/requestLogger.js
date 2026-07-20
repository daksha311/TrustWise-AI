const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  req._requestId = requestId;

  res.on('finish', () => {
    const elapsed = Date.now() - start;
    const info = {
      id: requestId,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      elapsed_ms: elapsed,
      disputeId: req.body && req.body.disputeId ? req.body.disputeId : undefined,
      escrowId: req.body && req.body.escrowId ? req.body.escrowId : undefined
    };
    logger.info(`[${info.id}] ${info.method} ${info.route} -> ${info.status} ${info.elapsed_ms}ms dispute=${info.disputeId || '-'} escrow=${info.escrowId || '-'}`);
  });

  next();
}

module.exports = requestLogger;
