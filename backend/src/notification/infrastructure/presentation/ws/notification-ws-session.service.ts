import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '@common/utils/public-api';
import { WebSocket } from 'ws';
import { NotificationFriendPresenceService } from '../../../application/services/notification-friend-presence.service';
import { UserBadgeCountsService } from '../../../application/services/user-badge-counts.service';
import { NotificationDispatchService } from '../../system/notification-dispatch.service';
import type { NotificationClientMeta } from './notification-ws.types';
import { WS_EVENTS } from '../../../../realtime/public-api';

@Injectable()
export class NotificationWsSessionService {
  private readonly logger = new Logger(NotificationWsSessionService.name);
  private readonly clients = new Map<WebSocket, NotificationClientMeta>();
  private readonly socketCountsByUserId = new Map<number, number>();

  constructor(
    private readonly notifications: NotificationDispatchService,
    private readonly counts: UserBadgeCountsService,
    private readonly friendPresence: NotificationFriendPresenceService,
  ) {}

  register(client: WebSocket, meta: NotificationClientMeta): void {
    const prevCount = this.socketCountsByUserId.get(meta.userId) ?? 0;
    this.clients.set(client, meta);
    this.notifications.register(meta.userId, client);
    this.socketCountsByUserId.set(meta.userId, prevCount + 1);

    if (prevCount === 0) {
      void this.friendPresence.notifyFriendsPresence(
        meta.userId,
        meta.username,
        true,
      );
    }
  }

  unregister(client: WebSocket): void {
    const meta = this.clients.get(client);
    this.clients.delete(client);
    if (!meta) {
      return;
    }

    this.notifications.unregister(meta.userId, client);
    const prevCount = this.socketCountsByUserId.get(meta.userId) ?? 0;
    const nextCount = Math.max(0, prevCount - 1);
    if (nextCount === 0) {
      this.socketCountsByUserId.delete(meta.userId);
      void this.friendPresence.notifyFriendsPresence(
        meta.userId,
        meta.username,
        false,
      );
    } else {
      this.socketCountsByUserId.set(meta.userId, nextCount);
    }
  }

  getMeta(client: WebSocket): NotificationClientMeta | null {
    return this.clients.get(client) ?? null;
  }

  async sendConnected(client: WebSocket, userId: number): Promise<void> {
    this.safeSend(client, {
      type: WS_EVENTS.notify.connected,
      payload: { userId },
    });

    try {
      const payload = await this.counts.getCounts(userId);
      this.logger.log(
        `notify.counts initial push for user ${userId}: ${JSON.stringify(payload)}`,
      );
      this.safeSend(client, { type: WS_EVENTS.notify.counts, payload });
    } catch {
      this.logger.warn(
        `notify.counts initial push failed for user ${userId}; client will retry`,
      );
      this.safeSend(client, {
        type: WS_EVENTS.notify.counts,
        payload: { unreadNotifications: 0, unreadMessages: 0 },
      });
    }
  }

  safeSend(client: WebSocket, payload: unknown): void {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      const type =
        payload &&
        typeof payload === 'object' &&
        'type' in payload &&
        typeof (payload as { type?: unknown }).type === 'string'
          ? (payload as { type: string }).type
          : 'unknown';
      this.logger.warn(
        `Echec envoi WS notify (type=${type}) : ${getErrorMessage(err)}`,
      );
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}
