import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export const CLIENT_UPDATE_MAX_TOTAL_BYTES = 600 * 1024 * 1024;

export async function listContiguousUploadParts(
  directory: string,
): Promise<Array<{ name: string; index: number }>> {
  const parts = (await fs.promises.readdir(directory))
    .filter((file) => file.endsWith('.part'))
    .map((name) => ({
      name,
      index: Number.parseInt(name.replace('.part', ''), 10),
    }))
    .filter((part) => Number.isFinite(part.index))
    .sort((left, right) => left.index - right.index);
  if (parts.length === 0) throw new BadRequestException('Aucun chunk recu.');
  for (let expected = 0; expected < parts.length; expected++) {
    if (parts[expected].index !== expected) {
      throw new BadRequestException(
        `Chunks manquants ou index non-contigus (attendu ${expected}).`,
      );
    }
  }
  return parts;
}

export async function assembleUploadArchive(
  directory: string,
  parts: readonly { name: string }[],
  archivePath: string,
): Promise<void> {
  const output = fs.createWriteStream(archivePath);
  const finished = new Promise<void>((resolve, reject) => {
    output.on('error', reject);
    output.on('finish', resolve);
  });
  try {
    for (const part of parts) {
      await new Promise<void>((resolve, reject) => {
        const input = fs.createReadStream(path.join(directory, part.name));
        input.on('error', reject);
        input.on('end', resolve);
        input.pipe(output, { end: false });
      });
    }
    output.end();
    await finished;
  } finally {
    output.destroy();
  }
}

export async function assertUploadArchiveSize(
  archivePath: string,
  expectedBytes: number | null,
): Promise<void> {
  const { size } = await fs.promises.stat(archivePath);
  if (size > CLIENT_UPDATE_MAX_TOTAL_BYTES) {
    throw new BadRequestException('Archive trop volumineuse.');
  }
  if (expectedBytes != null && size !== expectedBytes) {
    throw new BadRequestException(
      `Taille archive invalide (attendu ${expectedBytes}, reçu ${size}).`,
    );
  }
}
