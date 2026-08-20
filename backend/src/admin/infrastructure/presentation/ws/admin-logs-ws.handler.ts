import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminLogsService } from '../../../application/use-cases/admin-logs/admin-logs.service';
import { AdminLogsDownloadWsDto } from './admin-ws.dto';
import { WS_EVENTS } from '../../../../common/ws/ws-events';

@Injectable()
export class AdminLogsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly logs: AdminLogsService,
  ) {}

  async logsDownload(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminLogsDownloadWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.logs.download,
      payload: await this.logs.download(dto),
    };
  }
}
