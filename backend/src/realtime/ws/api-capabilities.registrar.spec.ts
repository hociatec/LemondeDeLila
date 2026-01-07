import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { ApiCapabilitiesWsRegistrar } from './api-capabilities.registrar';

describe('ApiCapabilitiesWsRegistrar', () => {
  it('includes isAdmin=false when unauthenticated', async () => {
    const registry = new WsRouteRegistry();
    const registrar = new ApiCapabilitiesWsRegistrar(registry);
    registrar.onModuleInit();

    const handler = registry.get('api.capabilities');
    expect(handler).toBeDefined();

    const res = await handler!({ user: null, connectionId: 'c1' }, {});

    expect(res?.type).toBe('api.capabilities');
    expect(res?.payload?.isAdmin).toBe(false);
  });

  it('includes isAdmin=true when user has admin role', async () => {
    const registry = new WsRouteRegistry();
    registry.register('admin.rooms.list', async () => null);
    registry.register('admin.rooms.destroy', async () => null);
    registry.register('admin.rooms.cleanup', async () => null);

    const registrar = new ApiCapabilitiesWsRegistrar(registry);
    registrar.onModuleInit();

    const res = await registry.get('api.capabilities')!(
      {
        user: { id: 1, username: 'u', roles: ['ROLE_ADMIN'] } as any,
        connectionId: 'c1',
      },
      {},
    );

    expect(res?.type).toBe('api.capabilities');
    expect(res?.payload?.isAdmin).toBe(true);
    expect(res?.payload?.features?.['admin.rooms.list']).toBe(true);
  });
});
