import { Inject, Injectable } from '@nestjs/common';
import type { AdminNotificationPort } from '../../application/ports/admin-notification.port';
import { WS_EVENTS } from '../../../../platform/realtime/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../notification/public-api';

@Injectable()
export class AdminNotificationAdapter implements AdminNotificationPort {
  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {}

  notifyUser(
    userId: number,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(userId, eventType, payload);
  }

  disconnectAll(reason?: string): void {
    this.notifications.disconnectAll(reason, WS_EVENTS.system.serverDisconnect);
  }
}
