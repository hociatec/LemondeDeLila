import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { stringOrEmpty } from '@shared/utils/public-api';
import { operationalSettings } from '../../../../platform/config/public-api';
import { toSoundErrorLike } from './sounds-storage.utils';

export type AudioProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export function ffmpegPath(): string {
  const candidate = ffmpegStatic ?? '';
  if (!candidate)
    throw new InternalServerErrorException(
      'ffmpeg indisponible (validation audio requise).',
    );
  return candidate;
}

export function ffprobePath(): string {
  const raw = ffprobeStatic as { path?: string } | string;
  const candidate = typeof raw === 'string' ? raw : (raw?.path ?? '');
  if (!candidate)
    throw new InternalServerErrorException(
      'ffprobe indisponible (validation audio requise).',
    );
  return candidate;
}

const AUDIO_PROCESS_CONCURRENCY = 2;
const AUDIO_PROCESS_QUEUE_LIMIT = 16;
let activeAudioProcesses = 0;
const waitingAudioProcesses: Array<() => void> = [];

export async function runAudioProcess(
  command: string,
  args: string[],
  timeoutMs = operationalSettings.soundProbeTimeoutMs,
): Promise<AudioProcessResult> {
  await acquireAudioProcessSlot();
  try {
    return await spawnAudioProcess(command, args, timeoutMs);
  } finally {
    releaseAudioProcessSlot();
  }
}

async function spawnAudioProcess(
  command: string,
  args: string[],
  timeoutMs = operationalSettings.soundProbeTimeoutMs,
): Promise<AudioProcessResult> {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 120_000
  ) {
    throw new RangeError('Délai du processus audio invalide.');
  }
  if (!Array.isArray(args) || args.length > 128) {
    throw new RangeError('Arguments du processus audio invalides.');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const maxOutputBytes = 1024 * 1024;
    let outputBytes = 0;
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // The process may already have exited between the timer and the kill.
      }
      reject(new Error(`Process timeout after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);
    const collect = (target: Buffer[], data: Buffer | Uint8Array) => {
      if (finished) return;
      outputBytes += data.byteLength;
      if (outputBytes > maxOutputBytes) {
        finished = true;
        clearTimeout(timer);
        try {
          child.kill('SIGKILL');
        } catch {
          /* Already exited. */
        }
        reject(new Error('Audio process output limit exceeded'));
        return;
      }
      target.push(Buffer.from(data));
    };
    child.stdout?.on('data', (data: Buffer | Uint8Array) =>
      collect(stdout, data),
    );
    child.stderr?.on('data', (data: Buffer | Uint8Array) =>
      collect(stderr, data),
    );
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
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

function acquireAudioProcessSlot(): Promise<void> {
  if (activeAudioProcesses < AUDIO_PROCESS_CONCURRENCY) {
    activeAudioProcesses += 1;
    return Promise.resolve();
  }
  if (waitingAudioProcesses.length >= AUDIO_PROCESS_QUEUE_LIMIT) {
    return Promise.reject(
      new ServiceUnavailableException('File audio saturée.'),
    );
  }
  return new Promise((resolve, reject) => {
    const admit = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      const index = waitingAudioProcesses.indexOf(admit);
      if (index >= 0) waitingAudioProcesses.splice(index, 1);
      reject(
        new ServiceUnavailableException('Délai de la file audio dépassé.'),
      );
    }, operationalSettings.soundProcessQueueTimeoutMs);
    waitingAudioProcesses.push(admit);
  });
}

function releaseAudioProcessSlot(): void {
  const next = waitingAudioProcesses.shift();
  if (next) {
    next();
    return;
  }
  activeAudioProcesses = Math.max(0, activeAudioProcesses - 1);
}

export function isAudioProcessSpawnError(error: unknown): boolean {
  const code = stringOrEmpty(toSoundErrorLike(error).code).toUpperCase();
  return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM';
}

export function audioToolExecutionError(
  tool: 'ffmpeg' | 'ffprobe',
  error: unknown,
  hint?: string,
): InternalServerErrorException {
  const errorLike = toSoundErrorLike(error);
  const code = stringOrEmpty(errorLike.code);
  const message = stringOrEmpty(errorLike.message);
  return new InternalServerErrorException(
    `Impossible d'exécuter ${tool}${code ? ` (${code})` : ''}${message ? `: ${message}` : ''}.${hint ? ` ${hint}` : ''}`.trim(),
  );
}
