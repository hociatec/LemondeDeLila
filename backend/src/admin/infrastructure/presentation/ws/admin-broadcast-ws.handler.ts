import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { AdminBroadcastService } from '../../../application/use-cases/admin-broadcast/admin-broadcast.service';
import { AdminBroadcastWsDto } from './dto/admin-ws.dto';
import { WS_EVENTS } from '../../../../realtime/public-api';

@Injectable()
export class AdminBroadcastWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly broadcasts: AdminBroadcastService,
  ) {}

  async broadcast(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminBroadcastWsDto, payload);
    const result = await this.broadcasts.broadcast({
      message: dto.message.trim(),
      fromUserId: admin.id,
      fromUsername: admin.username,
      eventType: WS_EVENTS.admin.broadcast,
    });

    return { type: WS_EVENTS.admin.broadcast, payload: result };
  }
}
