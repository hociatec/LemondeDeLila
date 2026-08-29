import { Inject, Injectable } from '@nestjs/common';
import { WS_EVENTS } from '../../../../platform/realtime/public-api';
import type { AdminNotificationPort } from '../../application/ports/admin-notification.port';
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

  notifyClientUpdateAvailable(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.clientUpdate.available,
      payload,
    );
  }

  notifyClientUpdateRequired(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.clientUpdate.required,
      payload,
    );
  }

  notifyClientUpdateImminent(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.clientUpdate.imminent,
      payload,
    );
  }

  disconnectAll(reason?: string): void {
    this.notifications.disconnectAll(reason, WS_EVENTS.system.serverDisconnect);
  }
}
