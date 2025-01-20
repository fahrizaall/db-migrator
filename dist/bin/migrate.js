#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const migration_1 = require("../src/migration");
const js_yaml_1 = __importDefault(require("js-yaml"));
const fs_1 = __importDefault(require("fs"));
// Allow custom config path
const configArg = process.argv.find(arg => arg.startsWith('--config='));
const configPath = configArg ? configArg.split('=')[1] : undefined;
const migration = new migration_1.Migration(configPath);
const command = process.argv[2];
const name = process.argv[3];
async function run() {
    switch (command) {
        case 'init': {
            const template = {
                host: 'localhost',
                user: 'your_username',
                password: 'your_password',
                database: 'your_database',
                port: 3306,
                migrations_table: 'migrations',
                migrations_dir: './migrations'
            };
            fs_1.default.writeFileSync('migration.yaml', js_yaml_1.default.dump(template, { indent: 2 }));
            console.log('Created migration.yaml template');
            break;
        }
        case 'create':
            if (!name) {
                console.error('Please provide a migration name');
                process.exit(1);
            }
            await migration.createMigration(name);
            break;
        case 'up':
            await migration.runMigrations('up');
            break;
        case 'down':
            await migration.runMigrations('down');
            break;
        default:
            console.log(`
Usage:
  migrate init                    Create template configuration file
  migrate create <name>          Create a new migration
  migrate up                     Run pending migrations
  migrate down                   Revert last migration

Options:
  --config=<path>               Specify custom config file path
      `);
            process.exit(1);
    }
}
run().catch(console.error);
