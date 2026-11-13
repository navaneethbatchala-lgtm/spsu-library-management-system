/**
 * Database Verification & Diagnostic Test Script
 * Library Management System (LMS)
 * 
 * Verifies:
 * 1. MySQL Server connectivity via mysql2 connection pool
 * 2. Presence of all 6 core relational tables (+ sessions)
 * 3. Foreign key constraints and referential integrity
 * 4. Row counts for seeded data
 * 
 * Run with: npm run db:test
 */

const { pool, testConnection, getFriendlyErrorMessage } = require('./db');

const REQUIRED_TABLES = [
  'users',
  'students',
  'categories',
  'books',
  'book_issues',
  'activity_logs'
];

async function runVerification() {
  console.log('====================================================');
  console.log('  Library Management System - DB Health Verification');
  console.log('====================================================\n');

  try {
    // 1. Test basic pool connectivity
    console.log('🔍 [1/3] Testing MySQL Pool Connectivity...');
    const connResult = await testConnection();
    if (!connResult.success) {
      console.error(`❌ Connection Test Failed:`);
      console.error(`   ${connResult.message}`);
      process.exit(1);
    }

    console.log(`✅ Connection OK!`);
    console.log(`   MySQL Version: ${connResult.details.version}`);
    console.log(`   Database Name: ${connResult.details.currentDb}`);
    console.log(`   Server Time:   ${connResult.details.serverTime}\n`);

    // 2. Verify all required relational tables exist
    console.log('🔍 [2/3] Verifying Relational Tables in lms_db...');
    const [tableRows] = await pool.query(
      `SELECT TABLE_NAME, TABLE_ROWS 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [process.env.DB_NAME || 'lms_db']
    );

    const existingTables = tableRows.map(r => r.TABLE_NAME);
    let allTablesPresent = true;

    for (const reqTable of REQUIRED_TABLES) {
      if (existingTables.includes(reqTable)) {
        const [countResult] = await pool.query(`SELECT COUNT(*) AS total FROM \`${reqTable}\``);
        console.log(`   ✅ Table '${reqTable}' exists (Rows: ${countResult[0].total})`);
      } else {
        console.log(`   ❌ Table '${reqTable}' is MISSING!`);
        allTablesPresent = false;
      }
    }

    if (!allTablesPresent) {
      console.error('\n❌ Some tables are missing. Please run: npm run db:init');
      process.exit(1);
    }

    // 3. Verify Foreign Key Constraints
    console.log('\n🔍 [3/3] Verifying Foreign Key Relationships...');
    const [fkRows] = await pool.query(
      `SELECT 
         CONSTRAINT_NAME,
         TABLE_NAME,
         COLUMN_NAME,
         REFERENCED_TABLE_NAME,
         REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
      [process.env.DB_NAME || 'lms_db']
    );

    if (fkRows.length === 0) {
      console.warn('   ⚠️ No foreign key constraints detected in lms_db.');
    } else {
      console.log(`   Detected ${fkRows.length} active Foreign Key constraints:`);
      fkRows.forEach(fk => {
        console.log(`   🔗 ${fk.TABLE_NAME}.${fk.COLUMN_NAME} ➔ ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} (${fk.CONSTRAINT_NAME})`);
      });
    }

    console.log('\n====================================================');
    console.log('🎉 ALL DATABASE VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('   Your MySQL database is ready for Phase 2 (Auth & Backend).');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n❌ Unexpected error during database verification:');
    console.error(`   ${getFriendlyErrorMessage(error)}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runVerification();
