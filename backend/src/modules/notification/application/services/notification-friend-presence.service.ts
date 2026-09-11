import { allCompleted } from '../../../../shared/utils/public-api';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorDetails } from '@shared/utils/public-api';
import {
  FRIEND_PRESENCE_NOTIFIER,
  type FriendPresenceNotifier,
} from '../ports/friend-presence-notifier.port';
import {
  NOTIFICATION_FRIENDSHIP_REPOSITORY,
  type NotificationFriendshipRepository,
} from '../ports/notification-friendship.repository';

@Injectable()
export class NotificationFriendPresenceService {
  private static readonly MAX_FRIENDS = 10_000;
  private static readonly NOTIFICATION_BATCH_SIZE = 100;
  private readonly logger = new Logger(NotificationFriendPresenceService.name);

  constructor(
    @Inject(NOTIFICATION_FRIENDSHIP_REPOSITORY)
    private readonly friendships: NotificationFriendshipRepository,
    @Inject(FRIEND_PRESENCE_NOTIFIER)
    private readonly notifier: FriendPresenceNotifier,
  ) {}

  async notifyFriendsPresence(
    userId: number,
    username: string | null | undefined,
    isOnline: boolean,
  ): Promise<void> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return;
    }

    try {
      const friendIds = [
        ...new Set(
          (await this.friendships.listAcceptedFriendIds(userId)).filter(
            (friendId) => Number.isSafeInteger(friendId) && friendId > 0,
          ),
        ),
      ].slice(0, NotificationFriendPresenceService.MAX_FRIENDS);
      if (friendIds.length === 0) {
        return;
      }

      const payload = {
        userId,
        username: (String(username || '').trim().slice(0, 255) ||
          `user#${userId}`),
      };

      this.logger.log(
        `Notify friends presence: user=${userId} ${isOnline ? 'online' : 'offline'} -> friends=${friendIds.join(',')}`,
      );

      for (
        let offset = 0;
        offset < friendIds.length;
        offset += NotificationFriendPresenceService.NOTIFICATION_BATCH_SIZE
      ) {
        const batch = friendIds.slice(
          offset,
          offset + NotificationFriendPresenceService.NOTIFICATION_BATCH_SIZE,
        );
        await allCompleted(
          batch.map((friendId) =>
            isOnline
              ? this.notifier.notifyFriendConnected(friendId, payload)
              : this.notifier.notifyFriendDisconnected(friendId, payload),
          ),
        );
      }
    } catch (err) {
      this.logger.debug('Friend notify failed', getErrorDetails(err));
    }
  }
}
