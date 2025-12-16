import { Global, Module } from '@nestjs/common';
import { WsRouteRegistry } from './ws-route-registry.service';
import { WsJwtAuthService } from './ws-jwt-auth.service';

@Global()
@Module({
  providers: [WsRouteRegistry, WsJwtAuthService],
  exports: [WsRouteRegistry, WsJwtAuthService],
})
export class WsRoutingModule {}
