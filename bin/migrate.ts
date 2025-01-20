#!/usr/bin/env node

import { Migration } from '../src/migration';
import yaml from 'js-yaml';
import fs from 'fs';
import { DatabaseConfig } from '../src/types';

// Allow custom config path
const configArg = process.argv.find(arg => arg.startsWith('--config='));
const configPath = configArg ? configArg.split('=')[1] : undefined;

const migration = new Migration(configPath);

const command = process.argv[2];
const name = process.argv[3];

async function run(): Promise<void> {
  switch (command) {
    case 'init': {
      const template: DatabaseConfig = {
        host: 'localhost',
        user: 'your_username',
        password: 'your_password',
        database: 'your_database',
        port: 3306,
        migrations_table: 'migrations',
        migrations_dir: './migrations'
      };
      
      fs.writeFileSync(
        'migration.yaml',
        yaml.dump(template, { indent: 2 })
      );
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