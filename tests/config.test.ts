// tests/config.test.ts
import { Config } from '../src/config';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Mock dotenv to prevent it from affecting the global environment
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Config', () => {
  const originalEnv = { ...process.env }; // Create a shallow copy of the original environment variables

  beforeEach(() => {
    jest.resetModules(); // Resets the module registry
    process.env = { ...originalEnv }; // Restore environment variables to their original state
  });

  afterAll(() => {
    process.env = originalEnv; // Final cleanup of environment variables
  });

  it('should load configuration from DATABASE_URL', () => {
    process.env.DATABASE_URL = 'mysql://user:pass@host:3307/dbname';

    const config = Config.load();

    expect(config).toEqual(
      expect.objectContaining({
        host: 'host',
        user: 'user',
        password: 'pass',
        database: 'dbname',
        port: 3307, // Port should be parsed correctly
        migrations_table: 'migrations',
        migrations_dir: './migrations',
        timezone: 'local',
        charset: 'utf8mb4',
      })
    );
  });

  it('should load configuration from environment variables', () => {
    process.env.DB_HOST = 'test-host';
    process.env.DB_USER = 'test-user';
    process.env.DB_PASSWORD = 'test-pass';
    process.env.DB_NAME = 'test-db';
    process.env.DB_PORT = '3307';
    process.env.DATABASE_URL = ''; // Ensure DATABASE_URL is empty to avoid interference
    delete process.env.DATABASE_URL;

    const config = Config.load();

    expect(config).toEqual(
      expect.objectContaining({
        host: 'test-host',
        user: 'test-user',
        password: 'test-pass',
        database: 'test-db',
        port: 3307, // Ensure this matches the expected integer
        migrations_table: 'migrations',
        migrations_dir: './migrations',
        timezone: 'local',
        charset: 'utf8mb4',
      })
    );
  });

  it('should load configuration from config file', () => {
    process.env.DATABASE_URL = '';
    process.env.DB_HOST = '';
    process.env.DB_USER = '';
    process.env.DB_PASSWORD = '';
    process.env.DB_NAME = '';
    process.env.DB_PORT = '';

    const testConfig = {
      host: 'config-host',
      user: 'config-user',
      password: 'config-pass',
      database: 'config-db',
      port: 3308,
    };

    // Create a temporary config file
    const configPath = path.join(__dirname, 'temp-test-config.js');
    try {
      fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(testConfig)}`);

      const config = Config.load(configPath);

      expect(config).toEqual(
        expect.objectContaining({
          ...testConfig,
          migrations_table: 'migrations',
          migrations_dir: './migrations',
          timezone: 'local',
          charset: 'utf8mb4',
        })
      );
    } finally {
      // Cleanup temporary file
      fs.unlinkSync(configPath);
    }
  });

  it('should throw an error when configuration file does not exist', () => {
    expect(() => {
      Config.load('non-existent-config.js');
    }).toThrowError(/Cannot find module/); // Matches specific error
  });

  it('should throw an error for invalid DATABASE_URL', () => {
    process.env.DATABASE_URL = 'invalid-url';

    expect(() => {
      Config.load();
    }).toThrowError(/Invalid DATABASE_URL/); // Ensure this error is handled in Config.load
  });
});
