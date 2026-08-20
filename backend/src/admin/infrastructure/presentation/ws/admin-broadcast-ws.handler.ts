import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminBroadcastService } from '../../../application/use-cases/admin-broadcast/admin-broadcast.service';
import { AdminBroadcastWsDto } from './admin-ws.dto';
import { WS_EVENTS } from '../../../../common/ws/ws-events';

@Injectable()
export class AdminBroadcastWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly broadcasts: AdminBroadcastService,
  ) {}

  async broadcast(session: WsSession, payload: any) {
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





