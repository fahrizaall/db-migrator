// tests/setup.ts
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not provided
process.env.TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.TEST_DB_USER = process.env.TEST_DB_USER || 'root';
process.env.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || '';
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || 'test_migrations';
process.env.TEST_DB_PORT = process.env.TEST_DB_PORT || '3306';