import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  ADMIN_LOGS_CONFIG_PORT,
  type AdminLogsConfigPort,
} from '../../application/ports/admin-logs-config.port';

@Injectable()
export class AdminLogsService {
  private static readonly MAX_LOG_BYTES = 16 * 1024 * 1024;
  private static readonly MAX_LINES = 2_000;
  private static readonly MAX_FILTER_LENGTH = 128;

  constructor(
    @Inject(ADMIN_LOGS_CONFIG_PORT)
    private readonly config: AdminLogsConfigPort,
  ) {}

  async download(input: { lines?: number; filter?: string }) {
    const linesCount = input.lines ?? 200;
    if (
      !Number.isSafeInteger(linesCount) ||
      linesCount < 1 ||
      linesCount > AdminLogsService.MAX_LINES
    ) {
      throw new BadRequestException('Nombre de lignes invalide');
    }
    const filter = input.filter?.trim() ?? '';
    if (filter.length > AdminLogsService.MAX_FILTER_LENGTH) {
      throw new BadRequestException('Filtre de logs trop long');
    }
    const logDir = this.config.getLogDir();
    const resolvedDir = path.resolve(logDir);

    let entries: string[];
    try {
      entries = await fs.promises.readdir(resolvedDir);
    } catch {
      throw new BadRequestException('Repertoire de logs introuvable');
    }

    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.toLowerCase().endsWith('.log'))
        .map(async (entry) => {
          const stat = await fs.promises.lstat(path.join(resolvedDir, entry));
          return { entry, stat };
        }),
    );

    if (!candidates.length) {
      throw new BadRequestException('Aucun fichier log disponible');
    }

    const latest = candidates
      .filter((candidate) => candidate.stat.isFile())
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0];
    if (!latest) {
      throw new BadRequestException('Aucun fichier log disponible');
    }
    if (latest.stat.size > AdminLogsService.MAX_LOG_BYTES) {
      throw new BadRequestException('Fichier log trop volumineux');
    }
    const content = await fs.promises.readFile(
      path.join(resolvedDir, latest.entry),
      'utf-8',
    );
    const allLines = content.split(/\r?\n/);
    const filtered = filter
      ? allLines.filter((line) => line.includes(filter))
      : allLines;

    return {
      file: latest.entry,
      lines: filtered.slice(-linesCount),
      total: filtered.length,
    };
  }
}
