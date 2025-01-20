export declare class Migration {
    private config;
    private migrationsDir;
    constructor(configPath?: string);
    private createConnection;
    createMigration(name: string): Promise<void>;
    runMigrations(direction?: 'up' | 'down' | 'fresh'): Promise<void>;
}
export default Migration;
