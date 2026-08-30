import { BadRequestException, HttpException } from '@nestjs/common';
import {
  assertStorageCapacity,
  parseVersion,
  StorageCapacityError,
} from '../../../../shared/utils/public-api';
import { readEnvironment } from '../../../../platform/config/public-api';
import { CLIENT_UPDATE_MAX_TOTAL_BYTES } from './client-update-upload-archive';

export function normalizeUploadId(input: unknown): string {
  const uploadId = typeof input === 'string' ? input.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(uploadId)) {
    throw new BadRequestException('uploadId invalide.');
  }
  return uploadId;
}

export function normalizeUploadTotalBytes(
  input: number | null | undefined,
): number | null {
  if (input == null) return null;
  if (
    !Number.isSafeInteger(input) ||
    input <= 0 ||
    input > CLIENT_UPDATE_MAX_TOTAL_BYTES
  ) {
    throw new BadRequestException('totalBytes invalide.');
  }
  return input;
}

export function normalizeVersion(input: unknown): string | null {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return null;
  if (parseVersion(value) == null) {
    throw new BadRequestException('Version invalide');
  }
  return value;
}

export function normalizeMinRequiredVersion(input: unknown): string | null {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return null;
  if (parseVersion(value) == null) {
    throw new BadRequestException('minRequiredVersion invalide');
  }
  return value;
}

export function normalizeMessage(input: unknown): string | null {
  const message = typeof input === 'string' ? input.trim() : '';
  return message || null;
}

export async function ensureClientUpdateStorageCapacity(
  root: string,
  incomingBytes: number,
): Promise<void> {
  try {
    await assertStorageCapacity({
      root,
      incomingBytes,
      maxTotalBytes: environmentBytes(
        'CLIENT_UPDATES_STORAGE_QUOTA_BYTES',
        4 * 1024 * 1024 * 1024,
      ),
      minFreeBytes: environmentBytes(
        'STORAGE_MIN_FREE_BYTES',
        512 * 1024 * 1024,
      ),
    });
  } catch (error) {
    throw clientUpdateStorageError(error);
  }
}

export function clientUpdateStorageError(error: unknown): unknown {
  if (
    error instanceof StorageCapacityError ||
    (isNodeError(error) && error.code === 'ENOSPC')
  ) {
    return new HttpException(
      error instanceof Error ? error.message : 'Espace disque insuffisant.',
      507,
    );
  }
  return error;
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function environmentBytes(
  key: 'CLIENT_UPDATES_STORAGE_QUOTA_BYTES' | 'STORAGE_MIN_FREE_BYTES',
  fallback: number,
): number {
  const raw = readEnvironment(key).trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
