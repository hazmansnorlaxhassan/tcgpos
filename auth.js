const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyfortcgpos123!';

function authenticateToken(req, res, next) {
  // Check authorization header or cookie or query param
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Try query param for cases like raw image previews or print templates
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
}

function isSalespersonOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'salesperson') {
    return res.status(403).json({ error: 'Access denied. Authorized role required.' });
  }
  next();
}

module.exports = {
  authenticateToken,
  isAdmin,
  isSalespersonOrAdmin,
  JWT_SECRET
};
