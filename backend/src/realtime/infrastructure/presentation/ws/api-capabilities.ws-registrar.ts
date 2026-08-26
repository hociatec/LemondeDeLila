import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../common/ws/public-api';
import { WS_EVENTS } from './ws-events';

@Injectable()
export class ApiCapabilitiesWsRegistrar implements OnModuleInit {
  constructor(private readonly registry: WsRouteRegistry) {}

  onModuleInit() {
    this.registry.register(
      WS_EVENTS.api.capabilities,
      async (session, _payload) => {
        const roles = Array.isArray(session.user?.roles)
          ? session.user.roles
          : [];
        const isAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
        const wsTypes = this.registry.listTypes();
        return {
          type: WS_EVENTS.api.capabilities,
          payload: {
            isAdmin,
            features: {
              [WS_EVENTS.admin.rooms.list]: this.registry.has(
                WS_EVENTS.admin.rooms.list,
              ),
              [WS_EVENTS.admin.rooms.destroy]: this.registry.has(
                WS_EVENTS.admin.rooms.destroy,
              ),
              [WS_EVENTS.admin.rooms.cleanup]: this.registry.has(
                WS_EVENTS.admin.rooms.cleanup,
              ),
            },
            routesCount: this.registry.listTypes().length,
            wsTypes,
            generatedAt: new Date().toISOString(),
          },
        };
      },
    );
  }
}
