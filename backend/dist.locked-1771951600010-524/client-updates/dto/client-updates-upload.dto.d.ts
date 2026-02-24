export declare class ClientUpdatesUploadMetaDto {
    version?: string;
    message?: string;
    minRequiredVersion?: string;
}
export declare class ClientUpdatesUploadInitDto extends ClientUpdatesUploadMetaDto {
    totalBytes?: number | null;
}
export declare class ClientUpdatesUploadChunkDto {
    uploadId: string;
    index: number;
}
export declare class ClientUpdatesUploadCompleteDto {
    uploadId: string;
}
