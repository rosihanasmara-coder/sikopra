// Pastikan user sudah login
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Pastikan user adalah admin
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') return res.redirect('/member/dashboard');
  next();
}

module.exports = { requireLogin, requireAdmin };
