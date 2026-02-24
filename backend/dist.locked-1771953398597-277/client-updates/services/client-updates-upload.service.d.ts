import { ClientUpdateMeta, ClientUpdatesService } from './client-updates.service';
export declare class ClientUpdatesUploadService {
    private readonly updates;
    private readonly logger;
    constructor(updates: ClientUpdatesService);
    private uploadsRoot;
    private completedUploadsRoot;
    private completedMarkerPath;
    private readCompletedMarker;
    private writeCompletedMarker;
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
        alreadyCompleted: boolean;
        meta: ClientUpdateMeta;
    } | {
        ok: boolean;
        meta: ClientUpdateMeta;
        alreadyCompleted?: undefined;
    }>;
}
