import { Module } from '@nestjs/common';
import { AdminContactService } from '../application/services/admin-contact.service';
import { NOTIFICATION_DISPATCHER } from '../application/ports/notification-dispatcher.port';
import { NOTIFICATION_INBOX_REPOSITORY } from '../application/ports/notification-inbox.repository';
import { USER_BADGE_COUNTS_NOTIFIER } from '../application/ports/user-badge-counts-notifier.port';
import { UserBadgeCountsService } from '../application/services/user-badge-counts.service';
import { NotificationDispatchService } from '../infrastructure/system/notification-dispatch.service';
import { NOTIFICATION_MODULE_IMPORTS } from './notification.module.imports';
import { NOTIFICATION_CORE_PROVIDERS } from './notification.module.providers.core';
import { NOTIFICATION_PRESENTATION_PROVIDERS } from './notification.module.providers.presentation';

@Module({
  imports: NOTIFICATION_MODULE_IMPORTS,
  providers: [
    ...NOTIFICATION_CORE_PROVIDERS,
    ...NOTIFICATION_PRESENTATION_PROVIDERS,
  ],
  exports: [
    NOTIFICATION_DISPATCHER,
    NotificationDispatchService,
    AdminContactService,
    UserBadgeCountsService,
    USER_BADGE_COUNTS_NOTIFIER,
    NOTIFICATION_INBOX_REPOSITORY,
  ],
})
export class NotificationModule {}
