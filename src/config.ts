import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { DatabaseConfig } from './types';

// Define configuration schema
const configSchema = z.object({
  host: z.string().default('localhost'),
  user: z.string(),
  password: z.string(),
  database: z.string(),
  port: z.number().default(3306),
  migrations_table: z.string().default('migrations'),
  migrations_dir: z.string().default('./migrations'),
  timezone: z.string().default('local'),
  charset: z.string().default('utf8mb4'),
});

export class Config {
  private static instance: DatabaseConfig | undefined;

  static load(configPath?: string): DatabaseConfig {
    // Load environment variables
    dotenv.config();

    if (this.instance) {
      return this.instance;
    }

    let config: Record<string, any> = {};

    // 1. Load from DATABASE_URL
    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        config = {
          host: url.hostname,
          user: url.username,
          password: url.password,
          database: url.pathname.slice(1),
          port: parseInt(url.port, 10),
        };
      } catch (error) {
        throw new Error('Invalid DATABASE_URL');
      }
    } else if (process.env.DB_HOST || process.env.DB_USER) {
      // 2. Load from DB_* environment variables
      config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
      };
    }

    // 3. Load from config file (if specified)
    if (configPath) {
      try {
        const customConfig = require(path.resolve(configPath));
        config = { ...config, ...customConfig };
      } catch (error) {
        throw new Error(`Cannot find module at ${configPath}`);
      }
    }

    // 4. Validate and apply defaults using Zod
    try {
      this.instance = configSchema.parse(config);
      return this.instance;
    } catch (error) {
      console.error('Configuration validation failed:', error);
      process.exit(1);
    }
  }

  static clear(): void {
      this.instance = undefined;
  }

  static setMigrationDir(dir: string): void {
    if (this.instance) {
      this.instance.migrations_dir = dir;
    }
  }
}
