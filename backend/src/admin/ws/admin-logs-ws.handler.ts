import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import * as fs from 'fs';
import * as path from 'path';
import { AdminLogsDownloadWsDto } from './admin-ws.dto';

@Injectable()
export class AdminLogsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly config: ConfigService,
  ) {}

  async logsDownload(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminLogsDownloadWsDto,
      payload ?? {},
    ) as AdminLogsDownloadWsDto;
    const linesCount = dto.lines ?? 200;
    const filter = dto.filter?.trim() ?? '';
    const logDir = this.config.get<string>('LOG_DIR') ?? 'log';
    const resolvedDir = path.resolve(logDir);
    let entries: string[];
    try {
      entries = await fs.promises.readdir(resolvedDir);
    } catch {
      throw new BadRequestException('Répertoire de logs introuvable');
    }
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.toLowerCase().endsWith('.log'))
        .map(async (entry) => ({
          entry,
          stat: await fs.promises.stat(path.join(resolvedDir, entry)),
        })),
    );
    if (!candidates.length) {
      throw new BadRequestException('Aucun fichier log disponible');
    }
    candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    const latest = candidates[0];
    const content = await fs.promises.readFile(
      path.join(resolvedDir, latest.entry),
      'utf-8',
    );
    const lines = content.split(/\r?\n/);
    const filtered = filter
      ? lines.filter((line) => line.includes(filter))
      : lines;
    const tail = filtered.slice(-linesCount);
    return {
      type: 'admin.logs.download',
      payload: {
        file: latest.entry,
        lines: tail,
        total: filtered.length,
      },
    };
  }
}

