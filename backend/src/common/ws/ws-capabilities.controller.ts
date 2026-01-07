import { Controller, Get } from '@nestjs/common';
import { WsRouteRegistry } from './ws-route-registry.service';

@Controller('api/capabilities')
export class WsCapabilitiesController {
  constructor(private readonly routes: WsRouteRegistry) {}

  @Get()
  getCapabilities() {
    return {
      ws: {
        types: this.routes.listTypes(),
      },
    };
  }
}
