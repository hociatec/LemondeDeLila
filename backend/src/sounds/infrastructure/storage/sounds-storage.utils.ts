import { InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';
import type {
  TableAmbienceDefinition,
  TableAmbienceSoundKey,
} from '../../application/models/sound-manifest.record';
import { stringOrEmpty } from '@common/utils/public-api';

export type SoundErrorLike = {
  code?: unknown;
  message?: unknown;
  stack?: string;
};

export function resolveSoundsDataRoot(options: {
  legacyRoot: string;
  warn: (message: string) => void;
}): string {
  const override = String(process.env.LMDL_SOUNDS_DIR ?? '').trim();
  if (override) return path.resolve(override);

  const { legacyRoot, warn } = options;
  const nodeEnv = String(process.env.NODE_ENV ?? '')
    .trim()
    .toLowerCase();

  if (nodeEnv !== 'production') {
    return legacyRoot;
  }

  const persistentRoot =
    process.platform === 'win32'
      ? path.join(
          String(
            process.env.PROGRAMDATA ?? path.join(homedir(), 'AppData', 'Local'),
          ),
          'lemonde-de-lila',
          'sounds',
        )
      : path.join(homedir(), '.local', 'share', 'lemonde-de-lila', 'sounds');

  bootstrapPersistentStorage(legacyRoot, persistentRoot);

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
    warn(
      `Persistent sounds dir not writable (${persistentRoot}); falling back to legacy (${legacyRoot}): ${toSoundErrorMessage(err)}`,
    );
    return legacyRoot;
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

  if (!soundId || !name) {
    return null;
  }

  return {
    soundId,
    name,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
  };
}

function hasDirectoryEntries(dir: string): boolean {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function bootstrapPersistentStorage(
  legacyRoot: string,
  persistentRoot: string,
): void {
  if (path.resolve(legacyRoot) === path.resolve(persistentRoot)) {
    return;
  }

  try {
    if (
      hasDirectoryEntries(legacyRoot) &&
      !hasDirectoryEntries(persistentRoot)
    ) {
      fs.mkdirSync(path.dirname(persistentRoot), { recursive: true });
      fs.cpSync(legacyRoot, persistentRoot, {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
    }
  } catch {
    // best-effort bootstrap
  }
}
