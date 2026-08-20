import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Inject } from '@nestjs/common';
import {
  ADMIN_LOGS_CONFIG_PORT,
  type AdminLogsConfigPort,
} from '../../ports/admin-logs-config.port';

@Injectable()
export class AdminLogsService {
  constructor(
    @Inject(ADMIN_LOGS_CONFIG_PORT)
    private readonly config: AdminLogsConfigPort,
  ) {}

  async download(input: { lines?: number; filter?: string }) {
    const linesCount = input.lines ?? 200;
    const filter = input.filter?.trim() ?? '';
    const logDir = this.config.getLogDir();
    const resolvedDir = path.resolve(logDir);

    let entries: string[];
    try {
      entries = await fs.promises.readdir(resolvedDir);
    } catch {
      throw new BadRequestException('RÃ©pertoire de logs introuvable');
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
