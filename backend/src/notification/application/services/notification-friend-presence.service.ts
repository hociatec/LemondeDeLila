import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorDetails } from '@common/utils/public-api';
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
    if (!userId) {
      return;
    }

    try {
      const friendIds = await this.friendships.listAcceptedFriendIds(userId);
      if (friendIds.length === 0) {
        return;
      }

      const payload = {
        userId,
        username: String(username || '').trim() || `user#${userId}`,
      };

      this.logger.log(
        `Notify friends presence: user=${userId} ${isOnline ? 'online' : 'offline'} -> friends=${friendIds.join(',')}`,
      );

      await Promise.all(
        friendIds.map((friendId) =>
          isOnline
            ? this.notifier.notifyFriendConnected(friendId, payload)
            : this.notifier.notifyFriendDisconnected(friendId, payload),
        ),
      );
    } catch (err) {
      this.logger.debug('Friend notify failed', getErrorDetails(err));
    }
  }
}
