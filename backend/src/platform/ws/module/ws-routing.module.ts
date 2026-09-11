import { Global, Module } from '@nestjs/common';
import { WsWorkService } from '../application/services/ws-work.service';
import { WsRequestRateLimitService } from '../application/services/ws-request-rate-limit.service';
import { WsApiHubService } from '../application/services/ws-api-hub.service';
import { WsJwtAuthService } from '../application/services/ws-jwt-auth.service';
import { WsRouteRegistry } from '../application/services/ws-route-registry.service';
import { WS_ROUTING_CORE_PROVIDERS } from './ws-routing.module.providers.core';
import { WS_ROUTING_CONTROLLERS } from './ws-routing.module.providers.presentation';

@Global()
@Module({
  controllers: WS_ROUTING_CONTROLLERS,
  providers: WS_ROUTING_CORE_PROVIDERS,
  exports: [
    WsWorkService,
    WsRouteRegistry,
    WsJwtAuthService,
    WsApiHubService,
    WsRequestRateLimitService,
  ],
})
export class WsRoutingModule {}
