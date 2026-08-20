import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { NotificationService } from '../../../../notification/services/notification.service';
import { User } from '../../../../user/entities/user.entity';
import { AdminBroadcastWsDto } from './admin-ws.dto';
import { WS_EVENTS } from '../../../../common/ws/ws-events';

@Injectable()
export class AdminBroadcastWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly notifications: NotificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async broadcast(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminBroadcastWsDto, payload);
    const message = dto.message.trim();

    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();

    const payloadOut = {
      message,
      fromUserId: admin.id,
      fromUsername: admin.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      ids.map((u) =>
        this.notifications.notifyUser(u.id, WS_EVENTS.admin.broadcast, payloadOut),
      ),
    );

    return { type: WS_EVENTS.admin.broadcast, payload: { delivered: ids.length } };
  }
}





