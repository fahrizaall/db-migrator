"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Define configuration schema
const configSchema = zod_1.z.object({
    host: zod_1.z.string().default('localhost'),
    user: zod_1.z.string(),
    password: zod_1.z.string(),
    database: zod_1.z.string(),
    port: zod_1.z.number().default(3306),
    migrations_table: zod_1.z.string().default('migrations'),
    migrations_dir: zod_1.z.string().default('./migrations'),
    timezone: zod_1.z.string().default('local'),
    charset: zod_1.z.string().default('utf8mb4'),
});
class Config {
    static load(configPath) {
        // Load environment variables
        dotenv_1.default.config();
        if (this.instance) {
            return this.instance;
        }
        let config = {};
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
            }
            catch (error) {
                throw new Error('Invalid DATABASE_URL');
            }
        }
        else if (process.env.DB_HOST || process.env.DB_USER) {
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
                const customConfig = require(path_1.default.resolve(configPath));
                config = { ...config, ...customConfig };
            }
            catch (error) {
                throw new Error(`Cannot find module at ${configPath}`);
            }
        }
        // 4. Validate and apply defaults using Zod
        try {
            this.instance = configSchema.parse(config);
            return this.instance;
        }
        catch (error) {
            console.error('Configuration validation failed:', error);
            process.exit(1);
        }
    }
}
exports.Config = Config;
