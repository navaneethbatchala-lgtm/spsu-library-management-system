/**
 * Authentication Controller
 * Handles login, logout, and current user session
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// POST /api/auth/login
async function login(req, res) {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const [users] = await pool.execute(
      'SELECT id, username, email, password_hash, role, full_name FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = users[0];

    // Role check if provided
    if (role && user.role !== role) {
      return res.status(401).json({ success: false, message: `This account is not registered as a ${role}.` });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Build session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.full_name
    };

    // Log activity
    await pool.execute(
      `INSERT INTO activity_logs (user_id, action_type, details, ip_address) VALUES (?, 'USER_LOGIN', ?, ?)`,
      [user.id, `${user.full_name} (${user.role}) logged in`, req.ip]
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  const user = req.session.user;
  req.session.destroy(async (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out. Please try again.' });
    }
    if (user) {
      try {
        await pool.execute(
          `INSERT INTO activity_logs (user_id, action_type, details, ip_address) VALUES (?, 'USER_LOGOUT', ?, ?)`,
          [user.id, `${user.fullName} logged out`, req.ip]
        );
      } catch (e) { /* ignore log error */ }
    }
    res.clearCookie('lms_session');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
}

// GET /api/auth/me
function me(req, res) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  return res.json({ success: true, user: req.session.user });
}

// POST /api/auth/change-password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const match = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('[CHANGE PASSWORD ERROR]', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { login, logout, me, changePassword };
