export interface DatabaseConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    migrations_table?: string;
    migrations_dir?: string;
    timezone?: string;
    charset?: string;
}

export interface MigrationFile {
    up: (connection: any) => Promise<void>;
    down: (connection: any) => Promise<void>;
}