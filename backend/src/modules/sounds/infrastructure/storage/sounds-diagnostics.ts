import * as fs from 'fs';
import * as path from 'path';
import { SOUND_KEYS } from '../../application/read-models/sound-manifest.record';
import type { SoundsMaintenanceDeps } from './sounds-reencoder';
import { findSoundSourcePath } from './sounds-source-path';
type SoundsDiagnosticItem = {
  soundId: string;
  inManifest: boolean;
  sha256: string | null;
  filePath: string | null;
  exists: boolean;
  bytes: number | null;
  url: string | null;
  uploadedAt: string | null;
};

export async function diagnoseSounds(
  deps: Pick<SoundsMaintenanceDeps, 'readManifest' | 'dataRoot' | 'now'>,
): Promise<{
  ok: true;
  dataRoot: string;
  manifestPath: string;
  manifestUpdatedAt: string;
  total: number;
  missing: string[];
  sounds: SoundsDiagnosticItem[];
}> {
  const manifest = await deps.readManifest();
  const root = deps.dataRoot();
  const missing: string[] = [];
  const sounds: SoundsDiagnosticItem[] = [];
  for (const soundId of SOUND_KEYS) {
    const entry = manifest.sounds?.[soundId];
    const sha256 = entry?.sha256 ?? null;
    const filePath = sha256 ? findSoundSourcePath(root, soundId, sha256) : null;
    const stat = filePath
      ? await fs.promises.stat(filePath).catch(() => null)
      : null;
    const exists = stat?.isFile() ?? false;
    if (entry?.sha256 && !exists) missing.push(soundId);
    sounds.push({
      soundId,
      inManifest: Boolean(entry?.sha256),
      sha256,
      filePath,
      exists,
      bytes: stat?.size ?? null,
      url: entry?.url ?? null,
      uploadedAt: entry?.uploadedAt ?? null,
    });
  }
  return {
    ok: true,
    dataRoot: root,
    manifestPath: path.join(root, 'manifest.json'),
    manifestUpdatedAt: manifest.updatedAt ?? deps.now(),
    total: sounds.length,
    missing,
    sounds,
  };
}
