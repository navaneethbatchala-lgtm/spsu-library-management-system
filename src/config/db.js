/**
 * Database Configuration & Connection Pool Module
 * Library Management System (LMS)
 * 
 * Uses 'mysql2/promise' for async/await queries, connection pooling,
 * prepared statements, and safe transaction handling.
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Support standard MySQL connection URI (for cloud providers) or discrete env vars
const connectionUri = process.env.MYSQL_URL || process.env.DB_URL || process.env.DATABASE_URL;
let parsedUri = null;
if (connectionUri && connectionUri.startsWith('mysql')) {
  try {
    parsedUri = new URL(connectionUri);
  } catch (err) {
    console.warn('[DB CONFIG] Invalid MySQL URL provided, falling back to discrete DB_* variables.');
  }
}

const useSsl = process.env.DB_SSL === 'true' ||
  (parsedUri && ['true', 'REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY'].includes(parsedUri.searchParams.get('ssl-mode') || parsedUri.searchParams.get('ssl')));

// Configuration options loaded safely from environment variables
const dbConfig = {
  host: (parsedUri && parsedUri.hostname) || process.env.DB_HOST || 'localhost',
  port: parseInt((parsedUri && parsedUri.port) || process.env.DB_PORT, 10) || 3306,
  user: (parsedUri && decodeURIComponent(parsedUri.username)) || process.env.DB_USER || 'root',
  password: (parsedUri && decodeURIComponent(parsedUri.password)) || process.env.DB_PASSWORD || '',
  database: (parsedUri && parsedUri.pathname.replace(/^\//, '')) || process.env.DB_NAME || 'lms_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true, // Returns MySQL dates as formatted strings instead of JS Date objects
  ...(useSsl ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {})
};

/**
 * Returns true when running locally OR when remote cloud MySQL credentials are configured.
 */
function hasDatabaseConfig() {
  if (!process.env.VERCEL) return true;
  return Boolean(parsedUri || (process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST)));
}

// Create the shared MySQL connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Diagnostic helper to translate MySQL error codes into beginner-friendly explanations
 * @param {Error} error - The caught MySQL exception
 * @returns {string} Human-readable advice
 */
function getFriendlyErrorMessage(error) {
  if (!error) return 'Unknown database error.';

  switch (error.code) {
    case 'ECONNREFUSED':
      return `[ECONNREFUSED] Cannot connect to MySQL at ${dbConfig.host}:${dbConfig.port}. Please verify that MySQL Server 8.0 is running.`;
    case 'ER_ACCESS_DENIED_ERROR':
      return `[ER_ACCESS_DENIED_ERROR] Access denied for user '${dbConfig.user}'. Please check DB_USER and DB_PASSWORD in your .env file.`;
    case 'ER_BAD_DB_ERROR':
      return `[ER_BAD_DB_ERROR] Database '${dbConfig.database}' does not exist. Run 'npm run db:init' to create the schema.`;
    case 'ENOTFOUND':
      return `[ENOTFOUND] Database host '${dbConfig.host}' could not be resolved.`;
    case 'ETIMEDOUT':
      return `[ETIMEDOUT] Connection attempt to MySQL timed out.`;
    case 'PROTOCOL_CONNECTION_LOST':
      return `[PROTOCOL_CONNECTION_LOST] MySQL connection was lost or closed unexpectedly.`;
    default:
      return `[${error.code || 'DB_ERROR'}] ${error.message}`;
  }
}

/**
 * Tests database connectivity and logs detailed status.
 * @returns {Promise<{ success: boolean, message: string, details?: object }>}
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT VERSION() AS version, DATABASE() AS currentDb, NOW() AS serverTime');
    connection.release();

    return {
      success: true,
      message: 'Successfully connected to MySQL database pool.',
      details: rows[0]
    };
  } catch (error) {
    const friendlyMessage = getFriendlyErrorMessage(error);
    return {
      success: false,
      message: friendlyMessage,
      error
    };
  }
}

/**
 * Executes a function within a managed database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and connection release.
 * 
 * Usage:
 *   const result = await withTransaction(async (conn) => {
 *     await conn.execute('UPDATE books SET ...', [params]);
 *     await conn.execute('INSERT INTO book_issues ...', [params]);
 *     return { status: 'success' };
 *   });
 * 
 * @param {Function} callback - Async function that receives the active connection
 * @returns {Promise<any>} Result returned by the callback
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Transaction rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Creates and configures a MySQL-backed session store for express-session.
 * Automatically creates and manages the `sessions` table in lms_db.
 * 
 * @param {object} session - The express-session package reference
 * @returns {object} Configured session store instance
 */
function createSessionStore(session) {
  if (!hasDatabaseConfig()) {
    console.warn('[SESSION STORE] Cloud MySQL env vars are not configured on Vercel yet.');
    return undefined;
  }

  const MySQLStore = require('express-mysql-session')(session);

  const sessionStoreOptions = {
    clearExpired: true,
    checkExpirationInterval: process.env.VERCEL ? 0 : 900000,
    expiration: 86400000,             // 1 day session TTL
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };

  const store = new MySQLStore(sessionStoreOptions, pool);
  store.on('error', (err) => {
    console.error('[SESSION STORE ERROR]', getFriendlyErrorMessage(err));
  });
  return store;
}

module.exports = {
  pool,
  dbConfig,
  hasDatabaseConfig,
  testConnection,
  withTransaction,
  createSessionStore,
  getFriendlyErrorMessage
};
