// tests/config.test.ts
import { Config } from '../src/config';
import fs from 'fs';
import path from 'path';

describe('Config', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_PORT;

    Config.clear(); // Clear the cached instance
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

    console.log(process.env.DATABASE_URL);

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
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    }
  });

  it('should throw an error when configuration file does not exist', () => {
    expect(() => {
      Config.load('non-existent-config.js');
    }).toThrow(); // Just check that it throws any error
  });

  it('should throw an error for invalid DATABASE_URL', () => {
    process.env.DATABASE_URL = 'invalid-url';

    expect(() => {
      Config.load();
    }).toThrow('Invalid DATABASE_URL'); // Check for specific error message
  });
});