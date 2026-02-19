const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'spring_legal_db',
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    };

const pool = new Pool(dbConfig);

async function checkDatabase() {
  try {
    console.log('Connecting to database...');
    // Select all columns from contacts, newest first
    const result = await pool.query('SELECT * FROM contacts ORDER BY id DESC');
    
    console.log(`\nFound ${result.rowCount} records:\n`);
    console.table(result.rows);
    
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await pool.end();
  }
}

checkDatabase();