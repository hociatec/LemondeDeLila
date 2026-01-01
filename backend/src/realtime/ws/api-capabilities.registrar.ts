import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';

@Injectable()
export class ApiCapabilitiesWsRegistrar implements OnModuleInit {
  constructor(private readonly registry: WsRouteRegistry) {}

  onModuleInit() {
    this.registry.register('api.capabilities', async (_session, _payload) => {
      // Keep this payload stable: clients can use it to avoid sending unsupported WS messages.
      return {
        type: 'api.capabilities',
        payload: {
          features: {
            'admin.rooms.list': this.registry.has('admin.rooms.list'),
            'admin.rooms.destroy': this.registry.has('admin.rooms.destroy'),
            'admin.rooms.cleanup': this.registry.has('admin.rooms.cleanup'),
          },
          routesCount: this.registry.listTypes().length,
          generatedAt: new Date().toISOString(),
        },
      };
    });
  }
}

