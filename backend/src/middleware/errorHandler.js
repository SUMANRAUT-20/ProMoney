/**
 * Global Error Handler Middleware
 * Author: Arpan
 */
export function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    status: statusCode
  });
}
