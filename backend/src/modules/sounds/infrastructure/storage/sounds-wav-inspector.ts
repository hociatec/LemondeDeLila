import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { bestEffort } from '@shared/utils/public-api';

type WavMeta = {
  durationSeconds: number;
  dataOffset: number;
  dataSize: number;
  bitsPerSample: number;
  audioFormat: number;
};

export async function readWavDuration(filePath: string): Promise<number> {
  return (await readWavMeta(filePath)).durationSeconds;
}

export async function isWavSilent(filePath: string): Promise<boolean> {
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
  const file = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(segmentSize);
    for (const offset of offsets) {
      const { bytesRead } = await file.read(buffer, 0, segmentSize, offset);
      if (bytesRead <= 0)
        throw new BadRequestException('Fichier WAV invalide (lecture).');
      if (buffer.subarray(0, bytesRead).some((value) => value !== silenceByte))
        return false;
    }
    return true;
  } finally {
    await bestEffort(file.close(), 'fermeture du fichier audio validé');
  }
}

async function readWavMeta(filePath: string): Promise<WavMeta> {
  const file = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(256 * 1024);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const data = buffer.subarray(0, bytesRead);
    assertWavHeader(data);
    const meta = parseWavChunks(data);
    const durationSeconds = meta.dataSize / meta.byteRate;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new BadRequestException('Fichier WAV invalide (durée nulle).');
    }
    return { ...meta, durationSeconds };
  } finally {
    await bestEffort(file.close(), 'fermeture du fichier audio analysé');
  }
}

function parseWavChunks(
  buffer: Buffer,
): Omit<WavMeta, 'durationSeconds'> & { byteRate: number } {
  let position = 12;
  let audioFormat = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let dataOffset = -1;
  let dataSize = 0;
  while (position + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', position, position + 4);
    const chunkSize = buffer.readUInt32LE(position + 4);
    position += 8;
    if (chunkId === 'fmt ') {
      if (position + 16 > buffer.length)
        throw new BadRequestException('Fichier WAV invalide (fmt).');
      audioFormat = buffer.readUInt16LE(position);
      const channels = buffer.readUInt16LE(position + 2);
      const sampleRate = buffer.readUInt32LE(position + 4);
      byteRate = buffer.readUInt32LE(position + 8);
      bitsPerSample = buffer.readUInt16LE(position + 14);
      if (!channels || !sampleRate || !byteRate || !bitsPerSample)
        throw new BadRequestException('Fichier WAV invalide (fmt).');
      if (audioFormat !== 1 && audioFormat !== 3)
        throw new BadRequestException(
          'Format WAV non supporté (seulement PCM/Float).',
        );
    } else if (chunkId === 'data') {
      dataOffset = position;
      dataSize = chunkSize;
    }
    position += chunkSize + (chunkSize % 2);
    if (audioFormat && dataOffset >= 0) break;
  }
  if (!audioFormat || dataOffset < 0 || dataSize <= 0 || !byteRate) {
    throw new BadRequestException('Fichier WAV invalide (données).');
  }
  return { dataOffset, dataSize, bitsPerSample, audioFormat, byteRate };
}

function assertWavHeader(buffer: Buffer): void {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new BadRequestException('Fichier WAV invalide (entête).');
}
