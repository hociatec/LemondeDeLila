import * as fs from 'fs';
import * as path from 'path';
import type { SoundKey } from '../../application/read-models/sound-manifest.record';

export function findSoundSourcePath(
  root: string,
  soundId: SoundKey,
  sha256: string,
): string | null {
  const soundDir = path.join(root, soundId);
  const wav = path.join(soundDir, `${sha256}.wav`);
  const mp3 = path.join(soundDir, `${sha256}.mp3`);
  if (fs.existsSync(wav)) return wav;
  if (fs.existsSync(mp3)) return mp3;
  return null;
}
