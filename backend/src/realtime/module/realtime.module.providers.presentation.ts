import { RealtimeApiConnectionService } from '../infrastructure/presentation/ws/realtime-api-connection.service';
import { RealtimeApiGateway } from '../infrastructure/presentation/ws/realtime-api.gateway';
import { RealtimeApiHandlerService } from '../infrastructure/presentation/ws/realtime-api-handler.service';
import { ApiCapabilitiesWsRegistrar } from '../infrastructure/presentation/ws/api-capabilities.ws-registrar';

export const REALTIME_PRESENTATION_PROVIDERS = [
  RealtimeApiGateway,
  RealtimeApiConnectionService,
  RealtimeApiHandlerService,
  ApiCapabilitiesWsRegistrar,
];
