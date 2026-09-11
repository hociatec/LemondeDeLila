import { Global, Module } from '@nestjs/common';
import { UNREAD_PRIVATE_MESSAGES_READER } from '../../modules/messaging/public-api';
import { MessagingModule } from '../../modules/messaging/composition-api';
import { ACCEPTED_FRIENDS_READER } from '../../modules/social/public-api';
import { SocialModule } from '../../modules/social/composition-api';
import {
  NOTIFICATION_UNREAD_MESSAGE_COUNTER,
  NOTIFICATION_FRIENDSHIP_REPOSITORY,
} from '../../modules/notification/public-api';

/** Application-owned bindings: bounded contexts do not import each other's storage. */
@Global()
@Module({
  imports: [MessagingModule, SocialModule],
  providers: [
    {
      provide: NOTIFICATION_UNREAD_MESSAGE_COUNTER,
      useExisting: UNREAD_PRIVATE_MESSAGES_READER,
    },
    {
      provide: NOTIFICATION_FRIENDSHIP_REPOSITORY,
      useExisting: ACCEPTED_FRIENDS_READER,
    },
  ],
  exports: [
    NOTIFICATION_UNREAD_MESSAGE_COUNTER,
    NOTIFICATION_FRIENDSHIP_REPOSITORY,
  ],
})
export class AppNotificationReadersModule {}
