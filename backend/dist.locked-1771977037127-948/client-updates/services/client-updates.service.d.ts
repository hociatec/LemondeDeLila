export type ClientUpdateMeta = {
    version: string;
    publishedAt: string;
    message?: string | null;
    publicUrl?: string | null;
    minRequiredVersion?: string | null;
};
export declare class ClientUpdatesService {
    private readonly logger;
    private readonly updatesDir;
    private readonly metaPath;
    private readonly legacyApplicationName;
    private readonly latestZipName;
    private latestMeta;
    private latestMetaMtimeMs;
    private hasDirectoryEntries;
    private bootstrapPersistentStorage;
    constructor();
    getTargetDir(): string;
    getPublicUrl(): string | null;
    resolveClientPublicUrl(latest: ClientUpdateMeta | null): string | null;
    resolveClientPublicUrlForOrigin(latest: ClientUpdateMeta | null, origin: string | null): string | null;
    getPublishedClickOnceVersionFromDisk(): Promise<string | null>;
    writeLandingPage(targetDir: string): Promise<void>;
    getLatest(): Promise<ClientUpdateMeta | null>;
    saveLatest(meta: ClientUpdateMeta): Promise<void>;
    getMinRequiredVersion(): Promise<string | null>;
    private assertZipSafe;
    private assertUnzipAvailable;
    private replaceDirectoryContents;
    applyZip(zipPath: string): Promise<void>;
    private ensureLegacyAliases;
}
