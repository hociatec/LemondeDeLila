import type {
  ClientUpdateMeta,
  CompletedUploadMarker,
  UploadMetaFile,
} from '../../application/contracts/client-update-meta.record';

export function decodeClientUpdateMeta(
  value: unknown,
): ClientUpdateMeta | null {
  if (
    !isRecord(value) ||
    typeof value.version !== 'string' ||
    typeof value.publishedAt !== 'string' ||
    !isOptionalNullableString(value.message) ||
    !isOptionalNullableString(value.publicUrl) ||
    !isOptionalNullableString(value.minRequiredVersion)
  ) {
    return null;
  }
  return {
    version: value.version,
    publishedAt: value.publishedAt,
    message: value.message,
    publicUrl: value.publicUrl,
    minRequiredVersion: value.minRequiredVersion,
  };
}

export function decodeUploadMetaFile(value: unknown): UploadMetaFile | null {
  if (
    !isRecord(value) ||
    typeof value.uploadId !== 'string' ||
    !isNullableString(value.version) ||
    !isNullableString(value.message) ||
    !isNullableString(value.minRequiredVersion) ||
    !isNullableFiniteNumber(value.totalBytes) ||
    typeof value.createdAt !== 'string' ||
    !isOptionalNullableString(value.completedAt)
  ) {
    return null;
  }
  return {
    uploadId: value.uploadId,
    version: value.version,
    message: value.message,
    minRequiredVersion: value.minRequiredVersion,
    totalBytes: value.totalBytes,
    createdAt: value.createdAt,
    completedAt: value.completedAt,
  };
}

export function decodeCompletedUploadMarker(
  value: unknown,
  expectedUploadId: string,
): CompletedUploadMarker | null {
  if (
    !isRecord(value) ||
    typeof value.uploadId !== 'string' ||
    value.uploadId.trim() !== expectedUploadId
  ) {
    return null;
  }
  const meta = decodeClientUpdateMeta(value.meta);
  if (!meta) {
    return null;
  }
  return {
    uploadId: expectedUploadId,
    completedAt:
      typeof value.completedAt === 'string'
        ? value.completedAt
        : new Date().toISOString(),
    meta,
  };
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return (
    value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
