// Express 4 doesn't catch rejected promises from async handlers on its
// own — an uncaught rejection here would otherwise leave the request
// hanging or crash the process. Wrap every async route handler with this.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
