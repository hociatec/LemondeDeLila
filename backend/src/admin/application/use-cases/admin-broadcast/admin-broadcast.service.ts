import { Inject, Injectable } from '@nestjs/common';
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
    private readonly users: AdminUserRepository,
    @Inject(ADMIN_NOTIFICATION_PORT)
    private readonly notifications: AdminNotificationPort,
  ) {}

  async broadcast(command: AdminBroadcastCommand): Promise<{ delivered: number }> {
    const userIds = await this.users.listIds();
    const payload = {
      message: command.message,
      fromUserId: command.fromUserId,
      fromUsername: command.fromUsername,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      userIds.map((userId) =>
        this.notifications.notifyUser(userId, command.eventType, payload),
      ),
    );

    return { delivered: userIds.length };
  }
}
