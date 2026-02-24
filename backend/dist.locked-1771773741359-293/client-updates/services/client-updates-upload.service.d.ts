import { ClientUpdateMeta, ClientUpdatesService } from './client-updates.service';
export declare class ClientUpdatesUploadService {
    private readonly updates;
    constructor(updates: ClientUpdatesService);
    private uploadsRoot;
    status(): Promise<{
        latest: ClientUpdateMeta | null;
        targetDir: string;
        publicUrl: string | null;
    }>;
    private normalizeVersion;
    private normalizeMinRequiredVersion;
    private normalizeMessage;
    private saveAndApplyZip;
    uploadSingleZip(params: {
        zipPath: string;
        version?: string;
        message?: string;
        minRequiredVersion?: string;
    }): Promise<{
        ok: boolean;
        meta: ClientUpdateMeta;
    }>;
    uploadInit(params: {
        version?: string;
        message?: string;
        minRequiredVersion?: string;
        totalBytes?: number | null;
    }): Promise<{
        uploadId: `${string}-${string}-${string}-${string}-${string}`;
    }>;
    uploadChunk(params: {
        uploadId: string;
        index: number;
        filePath: string;
    }): Promise<{
        ok: boolean;
        duplicate: boolean;
    } | {
        ok: boolean;
        duplicate?: undefined;
    }>;
    uploadComplete(params: {
        uploadId: string;
    }): Promise<{
        ok: boolean;
        meta: ClientUpdateMeta;
    }>;
}
