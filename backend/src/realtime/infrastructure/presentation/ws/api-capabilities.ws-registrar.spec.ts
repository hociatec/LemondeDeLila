import { WsRouteRegistry } from '../../../../common/ws/application/services/ws-route-registry.service';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { ApiCapabilitiesWsRegistrar } from './api-capabilities.ws-registrar';

describe('ApiCapabilitiesWsRegistrar', () => {
  it('includes isAdmin=false when unauthenticated', async () => {
    const registry = new WsRouteRegistry();
    const registrar = new ApiCapabilitiesWsRegistrar(registry);
    registrar.onModuleInit();

    const handler = registry.get(WS_EVENTS.api.capabilities);
    expect(handler).toBeDefined();

    const res = await handler!({ user: null, connectionId: 'c1' }, {});

    expect(res?.type).toBe(WS_EVENTS.api.capabilities);
    expect(res?.payload?.isAdmin).toBe(false);
  });

  it('includes isAdmin=true when user has admin role', async () => {
    const registry = new WsRouteRegistry();
    registry.register(WS_EVENTS.admin.rooms.list, async () => null);
    registry.register(WS_EVENTS.admin.rooms.destroy, async () => null);
    registry.register(WS_EVENTS.admin.rooms.cleanup, async () => null);

    const registrar = new ApiCapabilitiesWsRegistrar(registry);
    registrar.onModuleInit();

    const res = await registry.get(WS_EVENTS.api.capabilities)!(
      {
        user: { id: 1, username: 'u', roles: ['ROLE_ADMIN'] } as any,
        connectionId: 'c1',
      },
      {},
    );

    expect(res?.type).toBe(WS_EVENTS.api.capabilities);
    expect(res?.payload?.isAdmin).toBe(true);
    expect(res?.payload?.features?.[WS_EVENTS.admin.rooms.list]).toBe(true);
  });
});

