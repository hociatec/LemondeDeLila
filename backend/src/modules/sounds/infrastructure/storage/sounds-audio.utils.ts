import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { operationalPolicy } from '../../../../platform/config/public-api';
import {
  audioToolExecutionError,
  ffmpegPath,
  ffprobePath,
  isAudioProcessSpawnError,
  runAudioProcess,
} from './sounds-audio-process';
import { isWavSilent, readWavDuration } from './sounds-wav-inspector';

export async function probeSoundDurationSeconds(
  filePath: string,
  warn: (message: string) => void,
): Promise<number> {
  const ext = path.extname(filePath).toLowerCase();
  let toolPath: string;
  try {
    toolPath = ffprobePath();
  } catch (error) {
    if (isWav(ext)) return readWavDuration(filePath);
    throw error;
  }
  try {
    const result = await runAudioProcess(
      toolPath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        filePath,
      ],
      10_000,
    );
    if (result.code !== 0) {
      warn(`ffprobe failed: ${result.stderr || result.stdout}`);
      throw new BadRequestException(
        'Fichier audio invalide (durée illisible).',
      );
    }
    const duration = Number.parseFloat(result.stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BadRequestException('Fichier audio invalide (durée nulle).');
    }
    return duration;
  } catch (error) {
    if (isAudioProcessSpawnError(error) && isWav(ext))
      return readWavDuration(filePath);
    if (error instanceof BadRequestException) throw error;
    throw audioToolExecutionError(
      'ffprobe',
      error,
      'Utilisez un fichier .wav si ffprobe est bloqué sur ce serveur.',
    );
  }
}

export async function detectSoundSilence(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  let toolPath: string;
  try {
    toolPath = ffmpegPath();
  } catch (error) {
    if (isWav(ext)) return isWavSilent(filePath);
    throw error;
  }
  try {
    const result = await runAudioProcess(
      toolPath,
      [
        '-hide_banner',
        '-i',
        filePath,
        '-af',
        'volumedetect',
        '-f',
        'null',
        '-',
      ],
      20_000,
    );
    const match = `${result.stderr}\n${result.stdout}`.match(
      /max_volume:\s*([-\w.]+)\s*dB/i,
    );
    return match ? String(match[1]).toLowerCase() === '-inf' : false;
  } catch (error) {
    if (isAudioProcessSpawnError(error) && isWav(ext))
      return isWavSilent(filePath);
    throw audioToolExecutionError(
      'ffmpeg',
      error,
      'Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.',
    );
  }
}

export async function transcodeSoundToStableWav(
  inputPath: string,
  warn: (message: string) => void,
): Promise<{ outputPath: string; tempDir: string }> {
  const tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'lmdl-sound-'));
  const outputPath = path.join(tempDir, 'sound.wav');
  const result = await runAudioProcess(
    ffmpegPath(),
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '2',
      '-ar',
      '44100',
      '-codec:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      outputPath,
    ],
    operationalPolicy.soundTranscodeTimeoutMs,
  );
  if (result.code !== 0) {
    warn(`ffmpeg transcode failed: ${result.stderr || result.stdout}`);
    throw new BadRequestException('Fichier audio invalide (transcodage).');
  }
  return { outputPath, tempDir };
}

function isWav(extension: string): boolean {
  return extension === '.wav' || extension === '.wave';
}
