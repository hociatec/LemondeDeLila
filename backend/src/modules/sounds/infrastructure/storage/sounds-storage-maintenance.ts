import * as fs from 'fs';
import * as path from 'path';
import type { SoundKey } from '../../application/read-models/sound-manifest.record';

export async function removeUnusedFilesForSoundId(
  storageRoot: string,
  warn: (message: string) => void,
  soundId: SoundKey,
  keepSha256: string,
  options: { strict?: boolean } = {},
): Promise<number> {
  const soundDir = path.join(storageRoot, soundId);
  let deleted = 0;
  const failures: string[] = [];
  try {
    const files = await fs.promises.readdir(soundDir);
    for (const file of files) {
      const lower = file.toLowerCase();
      if (!(lower.endsWith('.wav') || lower.endsWith('.mp3'))) continue;
      if (file === `${keepSha256}.wav`) continue;
      try {
        await fs.promises.rm(path.join(soundDir, file), { force: true });
        deleted++;
      } catch (error) {
        failures.push(file);
        warn(
          `Nettoyage audio ignoré pour ${soundId}/${file}: ${errorMessage(error)}`,
        );
      }
    }
  } catch (error) {
    if (options.strict) throw error;
    warn(`Répertoire audio illisible pour ${soundId}: ${errorMessage(error)}`);
  }
  if (options.strict && failures.length > 0) {
    throw new Error(
      `Anciens fichiers audio non supprimés pour ${soundId}: ${failures.join(', ')}`,
    );
  }
  return deleted;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
