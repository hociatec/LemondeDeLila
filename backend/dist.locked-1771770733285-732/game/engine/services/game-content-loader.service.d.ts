export interface ContentLoadConfig<T = unknown> {
    gameType: string;
    baseDir: string;
    filename: string;
    contentDir?: string;
    validators?: Array<(data: unknown) => void>;
    transformer?: (data: unknown) => T;
    ttl?: number;
    logger?: (event: string, data: unknown) => void;
}
export interface ContentValidators {
    version: (expectedVersion: number) => (data: unknown) => void;
    arrayField: (field: string, minLength?: number) => (data: unknown) => void;
    requiredFields: (...fields: string[]) => (data: unknown) => void;
    typeCheck: (field: string, expectedType: string) => (data: unknown) => void;
    nonEmptyString: (field: string) => (data: unknown) => void;
    positiveNumber: (field: string) => (data: unknown) => void;
}
export declare class GameContentLoaderService {
    private readonly cache;
    readonly validators: ContentValidators;
    loadContent<T = unknown>(config: ContentLoadConfig<T>): T;
    isCached(gameType: string, filename: string): boolean;
    private buildPath;
    private buildCacheKey;
    private isCacheValid;
    private tryGetFileMtimeMs;
    private validateContent;
    private createError;
    private static toRecord;
    private static stringifyField;
    private normalizeErrorMessage;
}
