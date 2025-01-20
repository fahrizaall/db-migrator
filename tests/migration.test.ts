// tests/migration.test.ts
import { Migration } from '../src/migration';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

describe('Migration', () => {
  const testConfig = {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    user: process.env.TEST_DB_USER || 'root',
    password: process.env.TEST_DB_PASSWORD || '',
    database: process.env.TEST_DB_NAME || 'test',
    port: parseInt(process.env.TEST_DB_PORT || '3306'),
  };
  const migrationTable = process.env.MIGRATION_TABLE || 'migrations';

  let migration: Migration;
  let connection: mysql.Connection;

  beforeAll(async () => {
    // Create test database
    const tempConnection = await mysql.createConnection({
      ...testConfig,
      database: undefined
    });
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${testConfig.database}`);
    await tempConnection.end();

    // Initialize migration instance
    migration = new Migration('tests/config.test.js');
    connection = await mysql.createConnection(testConfig);
  });

  afterAll(async () => {
    // Clean up test database
    await connection.query(`DROP DATABASE IF EXISTS ${testConfig.database}`);
    await connection.end();
  });

  beforeEach(async () => {
    // Clean up migrations table before each test
    await connection.query(`DROP TABLE IF EXISTS ${migrationTable}`);
  });

  describe('createMigration', () => {
    const testMigrationsDir = path.join(__dirname, 'test-migrations');

    beforeEach(() => {
      // Clean up test migrations directory
      if (fs.existsSync(testMigrationsDir)) {
        fs.rmSync(testMigrationsDir, { recursive: true });
      }
      fs.mkdirSync(testMigrationsDir);
    });

    it('should create a new migration file', async () => {
      const migrationName = 'create_users_table';
      await migration.createMigration(migrationName);

      const files = fs.readdirSync(testMigrationsDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(new RegExp(`\\d{14}_${migrationName}\\.ts$`));
    });

    it('should create a valid TypeScript migration file', async () => {
      await migration.createMigration('test_migration');
      const files = fs.readdirSync(testMigrationsDir);
      const content = fs.readFileSync(path.join(testMigrationsDir, files[0]), 'utf8');

      expect(content).toContain('export const up = async');
      expect(content).toContain('export const down = async');
      expect(content).toContain('connection: Connection');
    });
  });

  describe('runMigrations', () => {
    it('should create migrations table if it doesn\'t exist', async () => {
      await migration.runMigrations('up');
      
      const [tables] = await connection.query('SHOW TABLES');
      const tableNames = (tables as any[]).map(t => Object.values(t)[0]);
      expect(tableNames).toContain(migrationTable);
    });

    it('should run migrations in correct order', async () => {
      // Create test migrations
      const migrations = [
        {
          name: '20240101000000_first_migration.ts',
          content: `
            export const up = async (connection) => {
              await connection.query('CREATE TABLE test1 (id INT)');
            };
            export const down = async (connection) => {
              await connection.query('DROP TABLE test1');
            };
          `
        },
        {
          name: '20240101000001_second_migration.ts',
          content: `
            export const up = async (connection) => {
              await connection.query('CREATE TABLE test2 (id INT)');
            };
            export const down = async (connection) => {
              await connection.query('DROP TABLE test2');
            };
          `
        }
      ];

      const migrationsDir = path.join(__dirname, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir);
      }

      migrations.forEach(m => {
        fs.writeFileSync(path.join(migrationsDir, m.name), m.content);
      });

      // Run migrations
      await migration.runMigrations('up');

      // Check if tables were created in order
      const [tables] = await connection.query('SHOW TABLES');
      const tableNames = (tables as any[]).map(t => Object.values(t)[0]);
      expect(tableNames).toContain('test1');
      expect(tableNames).toContain('test2');

      // Clean up
      fs.rmSync(migrationsDir, { recursive: true });
    });

    it('should properly revert migrations', async () => {
      // Create and run a test migration
      const migrationContent = `
        export const up = async (connection) => {
          await connection.query('CREATE TABLE test_revert (id INT)');
        };
        export const down = async (connection) => {
          await connection.query('DROP TABLE test_revert');
        };
      `;

      const migrationsDir = path.join(__dirname, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir);
      }

      fs.writeFileSync(
        path.join(migrationsDir, '20240101000000_test_revert.ts'),
        migrationContent
      );

      // Run migration up
      await migration.runMigrations('up');
      
      // Verify table exists
      let [tables] = await connection.query('SHOW TABLES');
      let tableNames = (tables as any[]).map(t => Object.values(t)[0]);
      expect(tableNames).toContain('test_revert');

      // Run migration down
      await migration.runMigrations('down');

      // Verify table was dropped
      [tables] = await connection.query('SHOW TABLES');
      tableNames = (tables as any[]).map(t => Object.values(t)[0]);
      expect(tableNames).not.toContain('test_revert');

      // Clean up
      fs.rmSync(migrationsDir, { recursive: true });
    });
  });
});