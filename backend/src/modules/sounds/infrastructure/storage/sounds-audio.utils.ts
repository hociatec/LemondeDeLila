import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { operationalSettings } from '../../../../platform/config/public-api';
import {
  readProbedSoundDuration,
  SOUND_INPUT_OPTIONS,
} from './sounds-media-validation';
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
  expectedExtension = path.extname(filePath).toLowerCase(),
): Promise<number> {
  const ext = expectedExtension;
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
        ...SOUND_INPUT_OPTIONS,
        '-show_entries',
        'format=duration,format_name:stream=codec_type',
        '-of',
        'json',
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
    return readProbedSoundDuration(result.stdout, ext);
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
        ...SOUND_INPUT_OPTIONS,
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
    if (result.code !== 0 || !match) {
      throw new BadRequestException('Analyse audio invalide ou incomplète.');
    }
    return String(match[1]).toLowerCase() === '-inf';
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
  try {
    const result = await runAudioProcess(
      ffmpegPath(),
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        ...SOUND_INPUT_OPTIONS,
        '-i',
        inputPath,
        '-vn',
        '-threads',
        '1',
        '-filter_threads',
        '1',
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
      operationalSettings.soundTranscodeTimeoutMs,
    );
    if (result.code !== 0) {
      warn(`ffmpeg transcode failed: ${result.stderr || result.stdout}`);
      throw new BadRequestException('Fichier audio invalide (transcodage).');
    }
    return { outputPath, tempDir };
  } catch (error) {
    await fs.promises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => warn('Nettoyage du transcodage temporaire impossible'));
    throw error;
  }
}

function isWav(extension: string): boolean {
  return extension === '.wav' || extension === '.wave';
}
