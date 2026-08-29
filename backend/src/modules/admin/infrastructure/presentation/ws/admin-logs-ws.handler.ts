import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { AdminLogsService } from '../../filesystem/admin-logs.service';
import { AdminLogsDownloadWsDto } from './dto/admin-ws.dto';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';

@Injectable()
export class AdminLogsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly logs: AdminLogsService,
  ) {}

  async logsDownload(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminLogsDownloadWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.logs.download,
      payload: await this.logs.download(dto),
    };
  }
}
