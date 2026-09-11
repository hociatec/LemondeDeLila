import { allCompleted } from '../../../../../shared/utils/public-api';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '@shared/interfaces/public-api';
import { businessMsToIso } from '@shared/utils/public-api';
import {
  ADMIN_NOTIFICATION_PORT,
  type AdminNotificationPort,
} from '../../ports/admin-notification.port';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../ports/admin-user.repository';

export interface AdminBroadcastCommand {
  message: string;
  fromUserId: number;
  fromUsername: string;
  eventType: string;
}

@Injectable()
export class AdminBroadcastService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: Pick<AdminUserRepository, 'scanIdBatches'>,
    @Inject(ADMIN_NOTIFICATION_PORT)
    private readonly notifications: AdminNotificationPort,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async broadcast(
    command: AdminBroadcastCommand,
  ): Promise<{ delivered: number }> {
    if (
      !Number.isSafeInteger(command.fromUserId) ||
      command.fromUserId <= 0 ||
      typeof command.message !== 'string' ||
      command.message.trim().length === 0 ||
      command.message.length > 2_000 ||
      typeof command.fromUsername !== 'string' ||
      command.fromUsername.length > 100 ||
      typeof command.eventType !== 'string' ||
      command.eventType.trim().length === 0 ||
      command.eventType.length > 128
    ) {
      throw new BadRequestException('Broadcast administrateur invalide.');
    }
    const payload = {
      message: command.message.trim(),
      fromUserId: command.fromUserId,
      fromUsername: command.fromUsername.trim(),
      timestamp: businessMsToIso(this.clock.now()),
    };

    let delivered = 0;
    for await (const userIds of this.users.scanIdBatches()) {
      await allCompleted(
        userIds.map((userId) =>
          this.notifications.notifyUser(userId, command.eventType, payload),
        ),
      );
      delivered += userIds.length;
    }
    return { delivered };
  }
}
