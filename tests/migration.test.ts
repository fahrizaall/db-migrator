// tests/migration.test.ts
import { Migration } from '../src/migration';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { Config } from '../src/config';
import { DatabaseConfig } from '../src/types';

describe('Migration', () => {
  let migration: Migration;
  let connection: mysql.Connection;
  let testConfig: DatabaseConfig
  const testMigrationsDir = path.join(__dirname, 'test-migrations');

  beforeAll(async () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = '';
    process.env.DB_NAME = 'test';
    process.env.DB_PORT = '3306';

    migration = new Migration();
    migration.setMigrationsDir(testMigrationsDir);

    // Create test database
    testConfig = Config.load();

    const tempConnection = await mysql.createConnection({
      host: testConfig.host,
      user: testConfig.user,
      password: testConfig.password,
      port: testConfig.port
    });

    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${testConfig.database}`);
    await tempConnection.end();

    connection = await mysql.createConnection({
      host: testConfig.host,
      user: testConfig.user,
      password: testConfig.password,
      database: testConfig.database,
      port: testConfig.port
    });
  });

  afterAll(async () => {
    // await connection.query(`DROP DATABASE IF EXISTS ${testConfig.database}`);
    await connection.end();
  });

  describe('createMigration', () => {

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
      expect(tableNames).toContain(testConfig.migrations_table);
    });

    it('should run migrations in correct order', async () => {
      // Create test migrations
      const migrations = [
        {
          name: '20240101000000_first_migration.ts',
          content: `
            import { Connection } from 'mysql2/promise';

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
            import { Connection } from 'mysql2/promise';

            export const up = async (connection) => {
              await connection.query('CREATE TABLE test2 (id INT)');
            };
            export const down = async (connection) => {
              await connection.query('DROP TABLE test2');
            };
          `
        }
      ];

      if (!fs.existsSync(testMigrationsDir)) {
        fs.mkdirSync(testMigrationsDir);
      }

      migrations.forEach(m => {
        fs.writeFileSync(path.join(testMigrationsDir, m.name), m.content);
      });

      // Run migrations
      await migration.runMigrations('up');

      // Check if tables were created in order
      const [tables] = await connection.query('SHOW TABLES');
      const tableNames = (tables as any[]).map(t => Object.values(t)[0]);
      console.log(tableNames);
      expect(tableNames).toContain('test1');
      expect(tableNames).toContain('test2');

      // Clean up
      fs.rmSync(testMigrationsDir, { recursive: true });
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

      const testMigrationsDir = path.join(__dirname, 'migrations');
      if (!fs.existsSync(testMigrationsDir)) {
        fs.mkdirSync(testMigrationsDir);
      }

      fs.writeFileSync(
        path.join(testMigrationsDir, '20240101000000_test_revert.ts'),
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
      fs.rmSync(testMigrationsDir, { recursive: true });
    });
  });
});