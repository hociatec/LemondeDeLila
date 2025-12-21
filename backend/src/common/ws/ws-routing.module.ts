import { Global, Module } from '@nestjs/common';
import { WsRouteRegistry } from './ws-route-registry.service';
import { WsJwtAuthService } from './ws-jwt-auth.service';
import { WsSignatureService } from './ws-signature.service';

@Global()
@Module({
  providers: [WsRouteRegistry, WsJwtAuthService, WsSignatureService],
  exports: [WsRouteRegistry, WsJwtAuthService, WsSignatureService],
})
export class WsRoutingModule {}
