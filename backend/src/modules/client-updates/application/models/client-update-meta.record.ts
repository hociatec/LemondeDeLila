export type ClientUpdateMeta = {
  version: string;
  publishedAt: string;
  message?: string | null;
  publicUrl?: string | null;
  minRequiredVersion?: string | null;
};

export type UploadMetaFile = {
  uploadId: string;
  version: string | null;
  message: string | null;
  minRequiredVersion: string | null;
  totalBytes: number | null;
  createdAt: string;
  completedAt?: string | null;
};

export type CompletedUploadMarker = {
  uploadId: string;
  completedAt: string;
  meta: ClientUpdateMeta;
};
