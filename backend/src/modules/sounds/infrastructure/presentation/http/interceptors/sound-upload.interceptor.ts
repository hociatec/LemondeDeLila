import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';

function filename(original: string): string {
  return Array.from(path.basename(String(original || 'sound')), (char) =>
    char.charCodeAt(0) < 32 ? '_' : char,
  )
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export const SoundUploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_request, _file, callback) => callback(null, os.tmpdir()),
    filename: (_request, file, callback) =>
      callback(
        null,
        `lila-sound-${randomUUID()}-${filename(file.originalname)}`,
      ),
  }),
  limits: { fileSize: 250 * 1024 * 1024, files: 1, fields: 2 },
});
