import { FRIEND_PRESENCE_NOTIFIER } from '../application/ports/friend-presence-notifier.port';
import { NOTIFICATION_INBOX_NOTIFIER } from '../application/ports/notification-inbox-notifier.port';
import { USER_BADGE_COUNTS_NOTIFIER } from '../application/ports/user-badge-counts-notifier.port';
import { NotificationGateway } from '../infrastructure/presentation/ws/notification.gateway';
import { NotificationFriendPresenceNotifierService } from '../infrastructure/presentation/ws/notification-friend-presence-notifier.service';
import { NotificationWsBadgeCountsService } from '../infrastructure/presentation/ws/notification-ws-badge-counts.service';
import { NotificationWsConnectionService } from '../infrastructure/presentation/ws/notification-ws-connection.service';
import { NotificationWsHandler } from '../infrastructure/presentation/ws/notification-ws.handler';
import { NotificationWsInboxHandler } from '../infrastructure/presentation/ws/notification-ws-inbox.handler';
import { NotificationWsInboxNotifierService } from '../infrastructure/presentation/ws/notification-ws-inbox-notifier.service';
import { NotificationWsSessionService } from '../infrastructure/presentation/ws/notification-ws-session.service';

export const NOTIFICATION_PRESENTATION_PROVIDERS = [
  NotificationGateway,
  NotificationWsConnectionService,
  NotificationWsHandler,
  NotificationWsInboxHandler,
  NotificationFriendPresenceNotifierService,
  NotificationWsBadgeCountsService,
  NotificationWsInboxNotifierService,
  NotificationWsSessionService,
  {
    provide: USER_BADGE_COUNTS_NOTIFIER,
    useExisting: NotificationWsBadgeCountsService,
  },
  {
    provide: NOTIFICATION_INBOX_NOTIFIER,
    useExisting: NotificationWsInboxNotifierService,
  },
  {
    provide: FRIEND_PRESENCE_NOTIFIER,
    useExisting: NotificationFriendPresenceNotifierService,
  },
];
