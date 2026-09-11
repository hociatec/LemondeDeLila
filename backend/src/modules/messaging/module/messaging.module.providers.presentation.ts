import { MessagingWsHandler } from '../infrastructure/presentation/ws/messaging-ws.handler';
import { MessagingWsRegistrar } from '../infrastructure/presentation/ws/messaging-ws.registrar';
import { MessagingWsNotificationService } from '../infrastructure/presentation/ws/messaging-ws-notification.service';
import {
  NOTIFICATION_DISPATCHER,
  USER_BADGE_COUNTS_NOTIFIER,
} from '../../notification/public-api';
import {
  MESSAGING_BADGE_COUNTS_NOTIFIER,
  MESSAGING_NOTIFICATION_DISPATCHER,
} from '../application/ports/messaging-notification.port';

export const MESSAGING_PRESENTATION_PROVIDERS = [
  {
    provide: MESSAGING_NOTIFICATION_DISPATCHER,
    useExisting: NOTIFICATION_DISPATCHER,
  },
  {
    provide: MESSAGING_BADGE_COUNTS_NOTIFIER,
    useExisting: USER_BADGE_COUNTS_NOTIFIER,
  },
  MessagingWsHandler,
  MessagingWsRegistrar,
  MessagingWsNotificationService,
];
