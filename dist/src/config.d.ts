import { DatabaseConfig } from './types';
export declare class Config {
    private static instance;
    static load(configPath?: string): DatabaseConfig;
}
