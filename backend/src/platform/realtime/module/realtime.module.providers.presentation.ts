import { RealtimeApiConnectionService } from '../infrastructure/presentation/ws/realtime-api-connection.service';
import { RealtimeApiGateway } from '../infrastructure/presentation/ws/realtime-api.gateway';
import { RealtimeGameGateway } from '../infrastructure/presentation/ws/realtime-game.gateway';
import { RealtimeApiHandlerService } from '../infrastructure/presentation/ws/realtime-api-handler.service';
import { ApiCapabilitiesWsRegistrar } from '../infrastructure/presentation/ws/api-capabilities.ws-registrar';
import { RealtimeRequestReplayService } from '../infrastructure/presentation/ws/realtime-request-replay.service';

export const REALTIME_PRESENTATION_PROVIDERS = [
  RealtimeApiGateway,
  RealtimeGameGateway,
  RealtimeApiConnectionService,
  RealtimeApiHandlerService,
  RealtimeRequestReplayService,
  ApiCapabilitiesWsRegistrar,
];
