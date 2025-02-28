import fs from 'fs';
import path from 'path';
import mysql, { Connection } from 'mysql2/promise';
import yaml from 'js-yaml';
import { DatabaseConfig, MigrationFile } from './types';
import { Config } from './config';

export class Migration {
  private config: DatabaseConfig;
  private migrationsDir: string;

  constructor(configPath?: string) {
    this.config = Config.load(configPath);
    this.migrationsDir = path.join(process.cwd(), 
      this.config.migrations_dir || 'migrations');
  }

  private async createConnection(): Promise<Connection> {
    return await mysql.createConnection({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      port: this.config.port,
    });
  }

  public setMigrationsDir(dir: string): void {
    this.migrationsDir = dir;
  }

  public async createMigration(name: string): Promise<void> {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const fileName = `${timestamp}_${name}.ts`;
    const filePath = path.join(this.migrationsDir, fileName);

    const template = `
    import { Connection } from 'mysql2/promise';

    export const up = async (connection: Connection): Promise<void> => {
        // Write your migration up logic here
        // Example:
        // await connection.query('CREATE TABLE users (id INT PRIMARY KEY)');
    };

    export const down = async (connection: Connection): Promise<void> => {
        // Write your migration down logic here
        // Example:
        // await connection.query('DROP TABLE users');
    };
    `;

    fs.writeFileSync(filePath, template);
    console.log(`Created migration: ${fileName}`);
  }

  public async runMigrations(direction: 'up' | 'down' | 'fresh' = 'up'): Promise<void> {
    const connection = await this.createConnection();

    try {
      // Create migrations table if it doesn't exist
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ${this.config.migrations_table || 'migrations'} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          batch INT DEFAULT 1,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

    //   `SELECT name FROM ${this.config.migrations_table || 'migrations'} WHERE batch = (SELECT MAX(batch) FROM ${this.config.migrations_table || 'migrations'})`

    //   // Get executed migrations
    //   const [executedMigrations] = await connection.query(
    //     `SELECT name FROM ${this.config.migrations_table || 'migrations'}`
    //   );
    //   const executedNames = (executedMigrations as Array<{ name: string }>)
    //     .map(m => m.name);

      // Get all migration files
      const migrationFiles = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .sort();

      if (direction === 'up') {
        // Get executed migrations
        const [executedMigrations] = await connection.query(
            `SELECT name FROM ${this.config.migrations_table || 'migrations'}`
        );
        const executedNames = (executedMigrations as Array<{ name: string }>)
            .map(m => m.name);
        const batch = await connection.query(
            `SELECT MAX(batch) as batch FROM ${this.config.migrations_table || 'migrations'}`
        );

        // Run pending migrations
        for (const file of migrationFiles) {
          if (!executedNames.includes(file)) {
            const migration: MigrationFile = require(path.join(this.migrationsDir, file));
            
            try {
              await migration.up(connection);
              await connection.query(
                `INSERT INTO ${this.config.migrations_table || 'migrations'} (name, batch) VALUES (?, ?)`,
                [file, batch]
              );
              console.log(`Executed migration: ${file}`);
            } catch (error) {
              console.error(`Error executing migration ${file}:`, error);
              break;
            }
          }
        }
      } else {
        // Get executed migrations
        const [executedMigrations] = await connection.query(
            `SELECT name FROM ${this.config.migrations_table || 'migrations'}`
        );
        const executedNames = (executedMigrations as Array<{ name: string }>)
            .map(m => m.name);

        // Get all migration files
        const migrationFiles = fs.readdirSync(this.migrationsDir)
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
            .sort();
        // Revert last migration
        const lastMigration = migrationFiles[migrationFiles.length - 1];
        if (lastMigration && executedNames.includes(lastMigration)) {
          const migration: MigrationFile = require(path.join(this.migrationsDir, lastMigration));
          
          try {
            await migration.down(connection);
            await connection.query(
              `DELETE FROM ${this.config.migrations_table || 'migrations'} WHERE name = ?`,
              [lastMigration]
            );
            console.log(`Reverted migration: ${lastMigration}`);
          } catch (error) {
            console.error(`Error reverting migration ${lastMigration}:`, error);
          }
        }
      }
    } finally {
      await connection.end();
    }
  }
}

export default Migration;