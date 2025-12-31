import { Global, Module } from '@nestjs/common';
import { WsRouteRegistry } from './ws-route-registry.service';
import { WsJwtAuthService } from './ws-jwt-auth.service';
import { WsSignatureService } from './ws-signature.service';
import { WsApiHubService } from './ws-api-hub.service';

@Global()
@Module({
  providers: [
    WsRouteRegistry,
    WsJwtAuthService,
    WsSignatureService,
    WsApiHubService,
  ],
  exports: [
    WsRouteRegistry,
    WsJwtAuthService,
    WsSignatureService,
    WsApiHubService,
  ],
})
export class WsRoutingModule {}
