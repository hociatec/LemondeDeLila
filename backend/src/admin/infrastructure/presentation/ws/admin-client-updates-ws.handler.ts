import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import { AdminClientUpdatesDispatchService } from '../../../application/use-cases/admin-client-updates/admin-client-updates-dispatch.service';
import {
  AdminClientUpdateAnnounceWsDto,
  AdminClientUpdateForceLatestWsDto,
  AdminClientUpdateScheduleWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminClientUpdatesWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly clientUpdateDispatch: AdminClientUpdatesDispatchService,
  ) {}

  async clientUpdateAnnounce(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateAnnounceWsDto,
      payload,
    );
    const result = await this.clientUpdateDispatch.announceAvailable({
      actor: { id: admin.id, username: admin.username },
      message: dto.message,
      version: dto.version,
    });

    return {
      type: WS_EVENTS.admin.clientUpdate.announce,
      payload: result,
    };
  }

  async clientUpdateForceLatest(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateForceLatestWsDto,
      payload ?? {},
    );
    const result = await this.clientUpdateDispatch.forceLatest({
      actor: { id: admin.id, username: admin.username },
      message: dto.message,
    });

    return {
      type: WS_EVENTS.admin.clientUpdate.forceLatest,
      payload: result,
    };
  }

  async clientUpdateSchedule(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateScheduleWsDto,
      payload,
    );
    const result = await this.clientUpdateDispatch.scheduleForcedUpdate({
      actor: { id: admin.id, username: admin.username },
      message: dto.message,
      delayMinutes: dto.delayMinutes,
      delaySeconds: dto.delaySeconds,
    });

    return {
      type: WS_EVENTS.admin.clientUpdate.schedule,
      payload: result,
    };
  }
}
