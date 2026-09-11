import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminLogsConfigPort } from '../../application/ports/admin-logs-config.port';

@Injectable()
export class AdminLogsConfigService implements AdminLogsConfigPort {
  constructor(private readonly config: ConfigService) {}

  getLogDir(): string {
    const configured = this.config.get<string>('LOG_DIR');
    if (typeof configured !== 'string' || !configured.trim() || configured.length > 4096) {
      return 'log';
    }
    return configured.trim();
  }
}
