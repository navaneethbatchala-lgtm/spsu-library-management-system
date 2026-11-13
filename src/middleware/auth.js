/**
 * Authentication & Role-Based Access Control Middleware
 */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Librarian/Admin role required.' });
  }
  next();
}

function requireStudent(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }
  if (req.session.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Access denied. Student role required.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireStudent };
