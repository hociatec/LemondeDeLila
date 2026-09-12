import { BadRequestException } from '@nestjs/common';
import { parseStrictNumber } from '../../../../shared/utils/public-api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const MIME_TYPES: Readonly<Record<string, readonly string[]>> = {
  '.mp3': ['audio/mpeg', 'audio/mp3', 'audio/x-mp3', 'audio/x-mpeg'],
  '.wav': ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'],
  '.wave': ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'],
};

export function assertSoundMime(extension: string, mimeType?: string): void {
  const mime = mimeType?.split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') return;
  if (!MIME_TYPES[extension]?.includes(mime)) {
    throw new BadRequestException(
      'Type MIME incompatible avec le format audio annoncé.',
    );
  }
}

export function readProbedSoundDuration(
  output: string,
  extension: string,
): number {
  if (
    typeof output !== 'string' ||
    Buffer.byteLength(output, 'utf8') > 256 * 1024
  ) {
    throw new BadRequestException('Analyse du contenu audio trop volumineuse.');
  }
  let probe: unknown;
  try {
    probe = JSON.parse(output);
  } catch {
    throw new BadRequestException('Analyse du contenu audio invalide.');
  }
  if (
    !isRecord(probe) ||
    !isRecord(probe.format) ||
    !Array.isArray(probe.streams)
  ) {
    throw new BadRequestException('Contenu audio illisible.');
  }
  const expected = extension === '.mp3' ? 'mp3' : 'wav';
  if (
    probe.format.format_name !== expected ||
    !probe.streams.some(
      (stream: unknown) => isRecord(stream) && stream.codec_type === 'audio',
    )
  ) {
    throw new BadRequestException(
      'Le contenu du fichier ne correspond pas au format audio annoncé.',
    );
  }
  const duration = parseStrictNumber(probe.format.duration);
  if (duration === null || duration <= 0 || duration > 86_400) {
    throw new BadRequestException('Fichier audio invalide (durée nulle).');
  }
  return duration;
}

/** Input-only options: no playlists, other containers or network protocols. */
export const SOUND_INPUT_OPTIONS = Object.freeze([
  '-protocol_whitelist',
  'file',
  '-format_whitelist',
  'wav,mp3',
]);
