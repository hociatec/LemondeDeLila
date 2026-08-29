import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminLogsConfigPort } from '../../application/ports/admin-logs-config.port';

@Injectable()
export class AdminLogsConfigService implements AdminLogsConfigPort {
  constructor(private readonly config: ConfigService) {}

  getLogDir(): string {
    return this.config.get<string>('LOG_DIR') ?? 'log';
  }
}
