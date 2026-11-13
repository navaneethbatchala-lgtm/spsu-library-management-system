/**
 * Database Initialization Script
 * Library Management System (LMS)
 * 
 * Safely executes schema.sql and seed.sql to initialize lms_db.
 * Run with: npm run db:init
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true // Allows executing multi-statement .sql scripts
};

async function executeSqlFile(connection, filePath, label) {
  console.log(`\n📄 Reading ${label}: ${path.basename(filePath)}...`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`⚡ Executing ${label} on MySQL server...`);
  await connection.query(sql);
  console.log(`✅ ${label} executed successfully!`);
}

async function runInit() {
  console.log('====================================================');
  console.log('  Library Management System - Database Initializer');
  console.log('====================================================');
  console.log(`Connecting to MySQL at ${config.host}:${config.port} as user '${config.user}'...`);

  let connection;
  try {
    // 1. Connect to MySQL server without selecting a database
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL Server successfully.');

    // 2. Execute schema.sql (creates lms_db and tables)
    const schemaPath = path.join(__dirname, 'schema.sql');
    await executeSqlFile(connection, schemaPath, 'Database Schema');

    // 3. Execute seed.sql (populates initial admin & sample data)
    const seedPath = path.join(__dirname, 'seed.sql');
    await executeSqlFile(connection, seedPath, 'Sample Seed Data');

    // 4. Verify tables in lms_db
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'lms_db' ORDER BY TABLE_NAME`
    );

    console.log('\n====================================================');
    console.log('🎉 Database Initialization Complete!');
    console.log('====================================================');
    console.log('Created Tables in lms_db:');
    tables.forEach((t, i) => console.log(`   ${i + 1}. ${t.TABLE_NAME}`));

    console.log('\nDefault Admin Credentials:');
    console.log('   Username: admin');
    console.log('   Password: Admin@123');
    console.log('\nDefault Student Credentials:');
    console.log('   Username: rahul101 | password: Student@123');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n❌ Database initialization failed:');
    if (error.code === 'ECONNREFUSED') {
      console.error(`   Connection refused at ${config.host}:${config.port}. Is MySQL Server 8.0 running?`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`   Access denied for user '${config.user}'. Check DB_PASSWORD in your .env file.`);
    } else {
      console.error(`   [${error.code || 'ERROR'}] ${error.message}`);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runInit();
