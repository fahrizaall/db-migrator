"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("./config");
class Migration {
    constructor(configPath) {
        this.config = config_1.Config.load(configPath);
        this.migrationsDir = path_1.default.join(process.cwd(), this.config.migrations_dir || 'migrations');
    }
    async createConnection() {
        return await promise_1.default.createConnection(this.config);
    }
    async createMigration(name) {
        if (!fs_1.default.existsSync(this.migrationsDir)) {
            fs_1.default.mkdirSync(this.migrationsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
        const fileName = `${timestamp}_${name}.ts`;
        const filePath = path_1.default.join(this.migrationsDir, fileName);
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
        fs_1.default.writeFileSync(filePath, template);
        console.log(`Created migration: ${fileName}`);
    }
    async runMigrations(direction = 'up') {
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
            const migrationFiles = fs_1.default.readdirSync(this.migrationsDir)
                .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
                .sort();
            if (direction === 'up') {
                // Get executed migrations
                const [executedMigrations] = await connection.query(`SELECT name FROM ${this.config.migrations_table || 'migrations'}`);
                const executedNames = executedMigrations
                    .map(m => m.name);
                const batch = await connection.query(`SELECT MAX(batch) as batch FROM ${this.config.migrations_table || 'migrations'}`);
                // Run pending migrations
                for (const file of migrationFiles) {
                    if (!executedNames.includes(file)) {
                        const migration = require(path_1.default.join(this.migrationsDir, file));
                        try {
                            await migration.up(connection);
                            await connection.query(`INSERT INTO ${this.config.migrations_table || 'migrations'} (name, batch) VALUES (?, ?)`, [file, batch]);
                            console.log(`Executed migration: ${file}`);
                        }
                        catch (error) {
                            console.error(`Error executing migration ${file}:`, error);
                            break;
                        }
                    }
                }
            }
            else {
                // Get executed migrations
                const [executedMigrations] = await connection.query(`SELECT name FROM ${this.config.migrations_table || 'migrations'}`);
                const executedNames = executedMigrations
                    .map(m => m.name);
                // Get all migration files
                const migrationFiles = fs_1.default.readdirSync(this.migrationsDir)
                    .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
                    .sort();
                // Revert last migration
                const lastMigration = migrationFiles[migrationFiles.length - 1];
                if (lastMigration && executedNames.includes(lastMigration)) {
                    const migration = require(path_1.default.join(this.migrationsDir, lastMigration));
                    try {
                        await migration.down(connection);
                        await connection.query(`DELETE FROM ${this.config.migrations_table || 'migrations'} WHERE name = ?`, [lastMigration]);
                        console.log(`Reverted migration: ${lastMigration}`);
                    }
                    catch (error) {
                        console.error(`Error reverting migration ${lastMigration}:`, error);
                    }
                }
            }
        }
        finally {
            await connection.end();
        }
    }
}
exports.Migration = Migration;
exports.default = Migration;
