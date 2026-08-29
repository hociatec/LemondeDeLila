import type {
  ClientUpdateMeta,
  CompletedUploadMarker,
} from '../models/client-update-meta.record';

export type ClientUpdatesUploadStorePort = {
  getUploadsRoot(): string;
  readCompletedMarker(uploadId: string): Promise<CompletedUploadMarker | null>;
  writeCompletedMarker(uploadId: string, meta: ClientUpdateMeta): Promise<void>;
};

export const CLIENT_UPDATES_UPLOAD_STORE_PORT = Symbol(
  'CLIENT_UPDATES_UPLOAD_STORE_PORT',
);
