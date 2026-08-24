import { Inject, Injectable } from '@nestjs/common';
import { WS_EVENTS } from '../../../../realtime/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../public-api';
import type { FriendPresenceNotifier } from '../../../application/ports/friend-presence-notifier.port';

@Injectable()
export class NotificationFriendPresenceNotifierService
  implements FriendPresenceNotifier
{
  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {}

  notifyFriendConnected(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.social.friendConnected,
      payload,
    );
  }

  notifyFriendDisconnected(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.social.friendDisconnected,
      payload,
    );
  }
}

