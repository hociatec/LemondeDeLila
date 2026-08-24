import { MessagingWsHandler } from '../infrastructure/presentation/ws/messaging-ws.handler';
import { MessagingWsRegistrar } from '../infrastructure/presentation/ws/messaging-ws.registrar';
import { MessagingWsNotificationService } from '../infrastructure/presentation/ws/messaging-ws-notification.service';

export const MESSAGING_PRESENTATION_PROVIDERS = [
  MessagingWsHandler,
  MessagingWsRegistrar,
  MessagingWsNotificationService,
];
