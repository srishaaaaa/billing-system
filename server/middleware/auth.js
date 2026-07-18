const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please sign in again.' });
  }
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.auth || req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'This section is only available to admins.' });
    }
    next();
  });
}

// Use inside a router that's already mounted behind requireAuth — just
// checks the role that requireAuth already attached to req.auth.
function adminOnly(req, res, next) {
  if (!req.auth || req.auth.role !== 'admin') {
    return res.status(403).json({ error: 'This section is only available to admins.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, adminOnly };
