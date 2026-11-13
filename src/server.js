/**
 * SPSU Library Management System - Main Server
 * Sir Padampat Singhania University
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createSessionStore, hasDatabaseConfig, testConnection } = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const studentRoutes = require('./routes/studentRoutes');
const issueRoutes = require('./routes/issueRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy headers (required for secure cookies behind Vercel HTTPS)
app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session store backed by MySQL
const sessionStore = createSessionStore(session);
const sessionConfig = {
  key: 'lms_session',
  secret: process.env.SESSION_SECRET || 'lms_spsu_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: 'auto', // HTTPS in production (Vercel), HTTP on localhost
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};
if (sessionStore) {
  sessionConfig.store = sessionStore;
}
app.use(session(sessionConfig));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ─── Health & Cloud DB Config Guard ───────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  if (!hasDatabaseConfig()) {
    return res.status(503).json({
      success: false,
      server: 'online',
      database: 'not_configured',
      message: 'Cloud MySQL environment variables are not set yet. Add MYSQL_URL (or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) in Vercel.'
    });
  }
  const dbStatus = await testConnection();
  return res.status(dbStatus.success ? 200 : 503).json({
    success: dbStatus.success,
    server: 'online',
    database: dbStatus.success ? 'connected' : 'error',
    message: dbStatus.message
  });
});

app.use('/api', (req, res, next) => {
  if (!hasDatabaseConfig()) {
    return res.status(503).json({
      success: false,
      message: 'Database not configured for cloud deployment. Please add MYSQL_URL (or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) in Vercel Environment Variables.'
    });
  }
  return next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Page Routes (SPA fallback) ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/admin-dashboard.html'));
});

app.get('/student/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/student-dashboard.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An internal server error occurred.'
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── Start Server (local / non-serverless) ──────────────────────────────────
if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   SPSU - Library Management System                  ║');
    console.log('║   Sir Padampat Singhania University, Udaipur        ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║   Server running at: http://localhost:${PORT}          ║`);
    console.log(`║   Environment: ${process.env.NODE_ENV || 'development'}                        ║`);
    console.log('╚══════════════════════════════════════════════════════╝');
  });
}

module.exports = app;
