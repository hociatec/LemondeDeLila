import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { toSoundErrorLike } from './sounds-storage.utils';
import { bestEffort, stringOrEmpty } from '@common/utils/public-api';
import { operationalPolicy } from '../../../config/public-api';

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export async function probeSoundDurationSeconds(
  filePath: string,
  warn: (message: string) => void,
): Promise<number> {
  const ext = path.extname(filePath).toLowerCase();
  let ffprobePath: string;
  try {
    ffprobePath = getFfprobePath();
  } catch (err) {
    if (ext === '.wav' || ext === '.wave') {
      return (await readWavMeta(filePath)).durationSeconds;
    }
    throw err;
  }

  let res: ProcessResult;
  try {
    res = await runSoundProcess(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        filePath,
      ],
      10000,
    );
  } catch (err) {
    if (
      isSoundSpawnExecutionError(err) &&
      (ext === '.wav' || ext === '.wave')
    ) {
      return (await readWavMeta(filePath)).durationSeconds;
    }
    throw createAudioToolExecutionError(
      'ffprobe',
      err,
      'Utilisez un fichier .wav si ffprobe est bloqué sur ce serveur.',
    );
  }

  if (res.code !== 0) {
    warn(`ffprobe failed: ${res.stderr || res.stdout}`);
    throw new BadRequestException('Fichier audio invalide (durée illisible).');
  }

  const duration = Number.parseFloat(String(res.stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new BadRequestException('Fichier audio invalide (durée nulle).');
  }
  return duration;
}

export async function detectSoundSilence(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  let ffmpegPath: string;
  try {
    ffmpegPath = getFfmpegPath();
  } catch (err) {
    if (ext === '.wav' || ext === '.wave') {
      return isWavSilent(filePath);
    }
    throw err;
  }

  let res: ProcessResult;
  try {
    res = await runSoundProcess(
      ffmpegPath,
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
      20000,
    );
  } catch (err) {
    if (
      isSoundSpawnExecutionError(err) &&
      (ext === '.wav' || ext === '.wave')
    ) {
      return isWavSilent(filePath);
    }
    throw createAudioToolExecutionError(
      'ffmpeg',
      err,
      'Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.',
    );
  }

  const output = `${res.stderr}\n${res.stdout}`;
  const match = output.match(/max_volume:\s*([-\\w.]+)\s*dB/i);
  if (!match) {
    return false;
  }
  return String(match[1]).toLowerCase() === '-inf';
}

export async function transcodeSoundToStableWav(
  inputPath: string,
  warn: (message: string) => void,
): Promise<{ outputPath: string; tempDir: string }> {
  const ffmpegPath = getFfmpegPath();
  const tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'lmdl-sound-'));
  const outputPath = path.join(tempDir, 'sound.wav');
  const res = await runSoundProcess(
    ffmpegPath,
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
  if (res.code !== 0) {
    warn(`ffmpeg transcode failed: ${res.stderr || res.stdout}`);
    throw new BadRequestException('Fichier audio invalide (transcodage).');
  }
  return { outputPath, tempDir };
}

function getFfmpegPath(): string {
  const candidate = ffmpegStatic ?? '';
  if (!candidate) {
    throw new InternalServerErrorException(
      'ffmpeg indisponible (validation audio requise).',
    );
  }
  return candidate;
}

function getFfprobePath(): string {
  const raw = ffprobeStatic as { path?: string } | string;
  const candidate = typeof raw === 'string' ? raw : (raw?.path ?? '');
  if (!candidate) {
    throw new InternalServerErrorException(
      'ffprobe indisponible (validation audio requise).',
    );
  }
  return candidate;
}

async function runSoundProcess(
  command: string,
  args: string[],
  timeoutMs = operationalPolicy.soundProbeTimeoutMs,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(new Error(`Process timeout after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    child.stdout?.on('data', (data: Buffer | Uint8Array) =>
      stdout.push(Buffer.from(data)),
    );
    child.stderr?.on('data', (data: Buffer | Uint8Array) =>
      stderr.push(Buffer.from(data)),
    );
    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        code: typeof code === 'number' ? code : -1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

export function isSoundSpawnExecutionError(err: unknown): boolean {
  const code = stringOrEmpty(toSoundErrorLike(err).code).toUpperCase();
  return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM';
}

export function createAudioToolExecutionError(
  tool: 'ffmpeg' | 'ffprobe',
  err: unknown,
  hint?: string,
): InternalServerErrorException {
  const errorLike = toSoundErrorLike(err);
  const errorCode = stringOrEmpty(errorLike.code);
  const errorMessage = stringOrEmpty(errorLike.message);
  const code = errorCode ? ` (${errorCode})` : '';
  const details = errorMessage ? `: ${errorMessage}` : '';
  const extra = hint ? ` ${hint}` : '';
  return new InternalServerErrorException(
    `Impossible d'exécuter ${tool}${code}${details}.${extra}`.trim(),
  );
}

function assertWavHeader(buffer: Buffer): void {
  if (buffer.length < 44) {
    throw new BadRequestException('Fichier WAV invalide (entête).');
  }
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new BadRequestException('Fichier WAV invalide (RIFF/WAVE).');
  }
}

async function readWavMeta(filePath: string): Promise<{
  durationSeconds: number;
  dataOffset: number;
  dataSize: number;
  bitsPerSample: number;
  audioFormat: number;
  byteRate: number;
}> {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const headerSize = 256 * 1024;
    const buf = Buffer.allocUnsafe(headerSize);
    const { bytesRead } = await fh.read(buf, 0, headerSize, 0);
    const b = buf.subarray(0, bytesRead);
    assertWavHeader(b);

    let pos = 12;
    let audioFormat = 0;
    let bitsPerSample = 0;
    let byteRate = 0;
    let dataOffset = -1;
    let dataSize = 0;

    while (pos + 8 <= b.length) {
      const chunkId = b.toString('ascii', pos, pos + 4);
      const chunkSize = b.readUInt32LE(pos + 4);
      pos += 8;

      if (chunkId === 'fmt ') {
        if (pos + 16 > b.length) {
          throw new BadRequestException('Fichier WAV invalide (fmt).');
        }
        audioFormat = b.readUInt16LE(pos + 0);
        const numChannels = b.readUInt16LE(pos + 2);
        const sampleRate = b.readUInt32LE(pos + 4);
        byteRate = b.readUInt32LE(pos + 8);
        bitsPerSample = b.readUInt16LE(pos + 14);

        if (!numChannels || !sampleRate || !byteRate || !bitsPerSample) {
          throw new BadRequestException('Fichier WAV invalide (fmt).');
        }
        if (audioFormat !== 1 && audioFormat !== 3) {
          throw new BadRequestException(
            'Format WAV non supporté (seulement PCM/Float).',
          );
        }
      } else if (chunkId === 'data') {
        dataOffset = pos;
        dataSize = chunkSize;
      }

      pos += chunkSize + (chunkSize % 2);

      if (audioFormat && dataOffset >= 0) break;
    }

    if (!audioFormat || dataOffset < 0 || dataSize <= 0 || !byteRate) {
      throw new BadRequestException('Fichier WAV invalide (données).');
    }

    const durationSeconds = dataSize / byteRate;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new BadRequestException('Fichier WAV invalide (durée nulle).');
    }

    return {
      durationSeconds,
      dataOffset,
      dataSize,
      bitsPerSample,
      audioFormat,
      byteRate,
    };
  } finally {
    await bestEffort(fh.close(), 'fermeture du fichier audio analysé');
  }
}

async function isWavSilent(filePath: string): Promise<boolean> {
  const meta = await readWavMeta(filePath);
  const silenceByte =
    meta.bitsPerSample === 8 && meta.audioFormat === 1 ? 0x80 : 0x00;
  const segmentSize = Math.min(64 * 1024, meta.dataSize);
  const offsets = [
    meta.dataOffset,
    meta.dataOffset +
      Math.max(0, Math.floor(meta.dataSize / 2) - Math.floor(segmentSize / 2)),
    meta.dataOffset + Math.max(0, meta.dataSize - segmentSize),
  ];

  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(segmentSize);
    for (const off of offsets) {
      const { bytesRead } = await fh.read(buf, 0, segmentSize, off);
      if (bytesRead <= 0) {
        throw new BadRequestException('Fichier WAV invalide (lecture).');
      }
      const slice = buf.subarray(0, bytesRead);
      for (let i = 0; i < slice.length; i++) {
        if (slice[i] !== silenceByte) {
          return false;
        }
      }
    }
    return true;
  } finally {
    await bestEffort(fh.close(), 'fermeture du fichier audio validé');
  }
}
