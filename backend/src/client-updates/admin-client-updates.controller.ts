import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { ClientUpdatesService } from './client-updates.service';

@Controller('api/admin/client-updates')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class AdminClientUpdatesController {
  constructor(private readonly updates: ClientUpdatesService) {}

  private uploadsRoot() {
    return path.join(os.tmpdir(), 'lila-client-update-uploads');
  }

  @Get('status')
  async status() {
    const latest = await this.updates.getLatest();
    return {
      latest,
      targetDir: this.updates.getTargetDir(),
      publicUrl: this.updates.getPublicUrl(),
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) =>
          cb(null, `lila-client-update-${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 600 * 1024 * 1024 }, // 600MB
    }),
  )
  async upload(
    @UploadedFile() file?: any,
    @Body() body?: any,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Fichier manquant (champ "file").');
    }

    const version =
      typeof body?.version === 'string' ? body.version.trim() : '';
    const message =
      typeof body?.message === 'string' ? body.message.trim() : '';
    const minRequiredVersion =
      typeof body?.minRequiredVersion === 'string'
        ? body.minRequiredVersion.trim()
        : '';

    const zipPath = file.path;
    try {
      if (!fs.existsSync(zipPath)) {
        throw new BadRequestException('Fichier upload introuvable.');
      }

      await this.updates.applyZip(zipPath);

      const publicUrl = this.updates.getPublicUrl();
      const meta = {
        version: version.length > 0 ? version : `uploaded-${Date.now()}`,
        publishedAt: new Date().toISOString(),
        message: message.length > 0 ? message : null,
        publicUrl,
        minRequiredVersion: minRequiredVersion.length > 0 ? minRequiredVersion : null,
      };
      await this.updates.saveLatest(meta);

      return { ok: true, meta };
    } finally {
      fs.promises.rm(zipPath, { force: true }).catch(() => {
        /* ignore */
      });
    }
  }

  // Chunked upload to stay under nginx client_max_body_size (default 20m on this server).
  @Post('upload/init')
  async init(@Body() body?: any) {
    const uploadId = randomUUID();

    const version =
      typeof body?.version === 'string' ? body.version.trim() : '';
    const message =
      typeof body?.message === 'string' ? body.message.trim() : '';
    const minRequiredVersion =
      typeof body?.minRequiredVersion === 'string'
        ? body.minRequiredVersion.trim()
        : '';
    const totalBytes =
      typeof body?.totalBytes === 'number' ? body.totalBytes : null;

    const root = this.uploadsRoot();
    const dir = path.join(root, uploadId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify(
        {
          uploadId,
          version: version.length > 0 ? version : null,
          message: message.length > 0 ? message : null,
          minRequiredVersion: minRequiredVersion.length > 0 ? minRequiredVersion : null,
          totalBytes,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    return { uploadId };
  }

  @Post('upload/chunk')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) =>
          cb(null, `lila-client-update-chunk-${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 15 * 1024 * 1024 }, // keep < 20m
    }),
  )
  async chunk(
    @UploadedFile() file?: any,
    @Body() body?: any,
  ) {
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    const indexRaw = typeof body?.index === 'string' ? body.index : '';
    const index = Number.parseInt(indexRaw, 10);
    if (!uploadId || !Number.isFinite(index) || index < 0) {
      throw new BadRequestException('uploadId/index invalides.');
    }
    if (!file?.path) {
      throw new BadRequestException('Chunk manquant (champ "file").');
    }

    const dir = path.join(this.uploadsRoot(), uploadId);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      throw new BadRequestException('Upload introuvable.');
    }

    const partPath = path.join(dir, `${index}.part`);
    await fs.promises.rename(file.path, partPath);
    return { ok: true };
  }

  @Post('upload/complete')
  async complete(@Body() body?: any) {
    const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
    if (!uploadId) {
      throw new BadRequestException('uploadId manquant.');
    }

    const dir = path.join(this.uploadsRoot(), uploadId);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      throw new BadRequestException('Upload introuvable.');
    }

    const metaRaw = await fs.promises.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw.replace(/^\uFEFF/, '')) as any;

    const parts = (await fs.promises.readdir(dir))
      .filter((f) => f.endsWith('.part'))
      .map((f) => ({
        name: f,
        index: Number.parseInt(f.replace('.part', ''), 10),
      }))
      .filter((p) => Number.isFinite(p.index))
      .sort((a, b) => a.index - b.index);

    if (parts.length === 0) {
      throw new BadRequestException('Aucun chunk reçu.');
    }

    const zipPath = path.join(os.tmpdir(), `lila-client-update-${uploadId}.zip`);
    const out = fs.createWriteStream(zipPath);
    try {
      for (const part of parts) {
        const partPath = path.join(dir, part.name);
        await new Promise<void>((resolve, reject) => {
          const input = fs.createReadStream(partPath);
          input.on('error', reject);
          out.on('error', reject);
          input.on('end', resolve);
          input.pipe(out, { end: false });
        });
      }
      await new Promise<void>((resolve, reject) => {
        out.end(() => resolve());
        out.on('error', reject);
      });

      await this.updates.applyZip(zipPath);

      const publicUrl = this.updates.getPublicUrl();
      const saved = {
        version: meta?.version || `uploaded-${Date.now()}`,
        publishedAt: new Date().toISOString(),
        message: meta?.message || null,
        publicUrl,
        minRequiredVersion: meta?.minRequiredVersion || null,
      };
      await this.updates.saveLatest(saved);

      return { ok: true, meta: saved };
    } finally {
      try {
        out.close();
      } catch {
        /* ignore */
      }
      fs.promises.rm(zipPath, { force: true }).catch(() => {
        /* ignore */
      });
      fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {
        /* ignore */
      });
    }
  }
}
