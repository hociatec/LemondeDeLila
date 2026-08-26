import { Inject, Injectable } from '@nestjs/common';
import { WS_EVENTS } from '../../../realtime/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../notification/public-api';
import type { VaultUserNotifier } from '../../application/ports/vault-user-notifier.port';

@Injectable()
export class VaultUserNotifierAdapter implements VaultUserNotifier {
  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {}

  async notifyRoomRestoreReady(input: {
    userId: number;
    roomId: number;
    roomName: string;
    ownerUserId: number;
  }): Promise<void> {
    await this.notifications.notifyUser(
      input.userId,
      WS_EVENTS.room.restoreReady,
      {
        roomId: input.roomId,
        roomName: input.roomName,
        by: { id: input.ownerUserId },
      },
    );
  }
}
