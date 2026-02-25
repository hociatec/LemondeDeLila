import { ClientUpdatesUploadChunkDto, ClientUpdatesUploadCompleteDto, ClientUpdatesUploadInitDto, ClientUpdatesUploadMetaDto } from '../dto/client-updates-upload.dto';
import { ClientUpdatesUploadService } from '../services/client-updates-upload.service';
type UploadedFileLike = {
    path?: unknown;
};
export declare class AdminClientUpdatesController {
    private readonly uploads;
    constructor(uploads: ClientUpdatesUploadService);
    status(): Promise<{
        latest: import("../services/client-updates.service").ClientUpdateMeta | null;
        targetDir: string;
        publicUrl: string | null;
    }>;
    upload(file?: UploadedFileLike, body?: ClientUpdatesUploadMetaDto): Promise<{
        ok: boolean;
        meta: import("../services/client-updates.service").ClientUpdateMeta;
    }>;
    init(body: ClientUpdatesUploadInitDto): Promise<{
        uploadId: `${string}-${string}-${string}-${string}-${string}`;
    }>;
    chunk(file?: UploadedFileLike, body?: ClientUpdatesUploadChunkDto): Promise<{
        ok: boolean;
        duplicate: boolean;
    } | {
        ok: boolean;
        duplicate?: undefined;
    }>;
    complete(body: ClientUpdatesUploadCompleteDto): Promise<{
        ok: boolean;
        alreadyCompleted: boolean;
        meta: import("../services/client-updates.service").ClientUpdateMeta;
    } | {
        ok: boolean;
        meta: import("../services/client-updates.service").ClientUpdateMeta;
        alreadyCompleted?: undefined;
    }>;
}
export {};
