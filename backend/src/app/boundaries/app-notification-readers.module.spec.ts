import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppNotificationReadersModule } from './app-notification-readers.module';
import { UNREAD_PRIVATE_MESSAGES_READER } from '../../modules/messaging/public-api';
import { MessagingModule } from '../../modules/messaging/composition-api';
import { ACCEPTED_FRIENDS_READER } from '../../modules/social/public-api';
import { SocialModule } from '../../modules/social/composition-api';
import {
  NOTIFICATION_UNREAD_MESSAGE_COUNTER,
  NOTIFICATION_FRIENDSHIP_REPOSITORY,
  type NotificationUnreadMessageCounter,
  type NotificationFriendshipRepository,
} from '../../modules/notification/public-api';

const messages = { countUnreadForRecipient: jest.fn().mockResolvedValue(3) };
const friends = { listAcceptedFriendIds: jest.fn().mockResolvedValue([7, 9]) };

@Module({
  providers: [{ provide: UNREAD_PRIVATE_MESSAGES_READER, useValue: messages }],
  exports: [UNREAD_PRIVATE_MESSAGES_READER],
})
class MessagingFixtureModule {}

@Module({
  providers: [{ provide: ACCEPTED_FRIENDS_READER, useValue: friends }],
  exports: [ACCEPTED_FRIENDS_READER],
})
class SocialFixtureModule {}

@Injectable()
class NotificationConsumer {
  constructor(
    @Inject(NOTIFICATION_UNREAD_MESSAGE_COUNTER)
    readonly messages: NotificationUnreadMessageCounter,
    @Inject(NOTIFICATION_FRIENDSHIP_REPOSITORY)
    readonly friends: NotificationFriendshipRepository,
  ) {}
}

@Module({ providers: [NotificationConsumer] })
class NotificationFixtureModule {}

describe('Application notification readers', () => {
  it('exposes owner readers in an independent notification module', async () => {
    const app = await Test.createTestingModule({
      imports: [AppNotificationReadersModule, NotificationFixtureModule],
    })
      .overrideModule(MessagingModule)
      .useModule(MessagingFixtureModule)
      .overrideModule(SocialModule)
      .useModule(SocialFixtureModule)
      .compile();
    try {
      const consumer = app.get(NotificationConsumer);
      expect(consumer.messages).toBe(messages);
      expect(consumer.friends).toBe(friends);
      await expect(consumer.messages.countUnreadForRecipient(42)).resolves.toBe(
        3,
      );
      await expect(consumer.friends.listAcceptedFriendIds(42)).resolves.toEqual(
        [7, 9],
      );
      expect(messages.countUnreadForRecipient).toHaveBeenCalledWith(42);
      expect(friends.listAcceptedFriendIds).toHaveBeenCalledWith(42);
    } finally {
      await app.close();
    }
  });
});
