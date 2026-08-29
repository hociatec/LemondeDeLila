import { Inject, Injectable } from '@nestjs/common';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../../notification/public-api';
import type { SocialRelationshipNotifier } from '../../../application/ports/social-relationship-notifier.port';

@Injectable()
export class SocialWsRelationshipNotifierService implements SocialRelationshipNotifier {
  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {}

  notifyFriendRequested(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.social.friendRequested,
      payload,
    );
  }

  notifyFriendAccepted(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.social.friendAccepted,
      payload,
    );
  }

  notifyFriendRejected(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.notifications.notifyUser(
      userId,
      WS_EVENTS.social.friendRejected,
      payload,
    );
  }
}
