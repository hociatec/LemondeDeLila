import { PresenceWsConnectionService } from '../infrastructure/presentation/ws/presence-ws-connection.service';
import { PresenceGateway } from '../infrastructure/presentation/ws/presence.gateway';
import { PresenceWsHandler } from '../infrastructure/presentation/ws/presence-ws.handler';

export const PRESENCE_PRESENTATION_PROVIDERS = [
  PresenceGateway,
  PresenceWsConnectionService,
  PresenceWsHandler,
];
