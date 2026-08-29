import { ConfigService } from '@nestjs/config';
import { WS_RUNTIME_CONFIG } from '../application/ports/ws-runtime-config.port';
import { WsApiHubService } from '../application/services/ws-api-hub.service';
import { WsJwtAuthService } from '../application/services/ws-jwt-auth.service';
import { WsRouteRegistry } from '../application/services/ws-route-registry.service';
import { WsSignatureService } from '../application/services/ws-signature.service';
import { createWsRuntimeConfig } from '../infrastructure/config/ws-runtime.config';

export const WS_ROUTING_CORE_PROVIDERS = [
  {
    provide: WS_RUNTIME_CONFIG,
    inject: [ConfigService],
    useFactory: createWsRuntimeConfig,
  },
  WsRouteRegistry,
  WsJwtAuthService,
  WsSignatureService,
  WsApiHubService,
];
