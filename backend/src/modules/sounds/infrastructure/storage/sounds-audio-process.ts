import { InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { stringOrEmpty } from '@shared/utils/public-api';
import { operationalPolicy } from '../../../../platform/config/public-api';
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

export async function runAudioProcess(
  command: string,
  args: string[],
  timeoutMs = operationalPolicy.soundProbeTimeoutMs,
): Promise<AudioProcessResult> {
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
        // The process may already have exited between the timer and the kill.
      }
      reject(new Error(`Process timeout after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);
    child.stdout?.on('data', (data: Buffer | Uint8Array) =>
      stdout.push(Buffer.from(data)),
    );
    child.stderr?.on('data', (data: Buffer | Uint8Array) =>
      stderr.push(Buffer.from(data)),
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
