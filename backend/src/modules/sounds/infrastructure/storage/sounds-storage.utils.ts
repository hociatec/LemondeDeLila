import { InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import { homedir } from 'os';
import { readEnvironment } from '../../../../platform/config/public-api';
import * as path from 'path';
import {
  SOUND_KEYS,
  type SoundKey,
  type SoundManifest,
  type SoundManifestEntry,
  TableAmbienceDefinition,
  TableAmbienceSoundKey,
} from '../../application/contracts/sound-manifest.record';
import { stringOrEmpty } from '@shared/utils/public-api';

export type SoundErrorLike = {
  code?: unknown;
  message?: unknown;
  stack?: string;
};

const SOUND_KEY_SET = new Set<string>(SOUND_KEYS);

export function decodeSoundManifest(value: unknown): SoundManifest | null {
  if (
    !isRecord(value) ||
    typeof value.updatedAt !== 'string' ||
    !isRecord(value.sounds)
  ) {
    return null;
  }
  const sounds: Partial<Record<SoundKey, SoundManifestEntry>> = {};
  for (const [key, entry] of Object.entries(value.sounds)) {
    if (!SOUND_KEY_SET.has(key) || !isSoundManifestEntry(entry, key)) {
      return null;
    }
    sounds[entry.soundId] = entry;
  }
  return { updatedAt: value.updatedAt, sounds };
}

function isSoundManifestEntry(
  value: unknown,
  expectedKey: string,
): value is SoundManifestEntry {
  return (
    isRecord(value) &&
    value.soundId === expectedKey &&
    SOUND_KEY_SET.has(expectedKey) &&
    typeof value.sha256 === 'string' &&
    typeof value.bytes === 'number' &&
    Number.isFinite(value.bytes) &&
    value.bytes >= 0 &&
    typeof value.uploadedAt === 'string' &&
    typeof value.url === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveSoundsDataRoot(): string {
  const override = readEnvironment('LMDL_SOUNDS_DIR').trim();
  if (override) return path.resolve(override);

  const persistentRoot =
    process.platform === 'win32'
      ? path.join(
          String(
            readEnvironment(
              'PROGRAMDATA',
              path.join(homedir(), 'AppData', 'Local'),
            ),
          ),
          'lemonde-de-lila',
          'sounds',
        )
      : path.join(homedir(), '.local', 'share', 'lemonde-de-lila', 'sounds');

  try {
    fs.mkdirSync(persistentRoot, { recursive: true });
    const testFile = path.join(
      persistentRoot,
      `.write-test-${process.pid}-${Date.now()}`,
    );
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.rmSync(testFile, { force: true });
    return persistentRoot;
  } catch (err) {
    throw new InternalServerErrorException(
      `Stockage des sons inaccessible (${persistentRoot}): ${toSoundErrorMessage(err)}`,
    );
  }
}

export function buildStorageIoError(
  action: string,
  err: unknown,
  logError: (message: string, stack?: string) => void,
): InternalServerErrorException {
  const errorLike = toSoundErrorLike(err);
  const errorCode = stringOrEmpty(errorLike.code);
  const errorMessage = stringOrEmpty(errorLike.message);
  const code = errorCode ? ` (${errorCode})` : '';
  const details = errorMessage ? `: ${errorMessage}` : '';

  logError(
    `Sound storage error during ${action}${code}${details}`,
    errorLike.stack,
  );

  return new InternalServerErrorException(
    `Erreur stockage sons pendant ${action}${code}${details}. Vérifiez les permissions du dossier de données.`.trim(),
  );
}

export function toSoundErrorLike(err: unknown): SoundErrorLike {
  if (!err || typeof err !== 'object') {
    return {
      message: err,
    };
  }
  const record = err as Record<string, unknown>;
  return {
    code: record.code,
    message: record.message,
    stack: typeof record.stack === 'string' ? record.stack : undefined,
  };
}

export function toSoundErrorMessage(
  err: unknown,
  fallback = 'Erreur inconnue',
): string {
  const { message } = toSoundErrorLike(err);
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function toTableAmbienceDefinition(
  value: unknown,
  normalizeKey: (input: string) => TableAmbienceSoundKey,
): TableAmbienceDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const soundId = normalizeKey(stringOrEmpty(record.soundId));
  const name = stringOrEmpty(record.name).trim();

  if (!soundId || !name || typeof record.enabled !== 'boolean') {
    return null;
  }

  return {
    soundId,
    name,
    enabled: record.enabled,
  };
}
