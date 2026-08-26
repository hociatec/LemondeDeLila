import { WsRouteRegistry } from '../../../../../realtime/public-api';
import { GameWsRegistrar } from './game-ws.registrar';

describe('GameWsRegistrar', () => {
  it('registers only the official game routes', () => {
    const registry = new WsRouteRegistry();
    const handler = {
      rules: jest.fn(async () => null),
      modules: jest.fn(async () => null),
    } as any;

    const registrar = new GameWsRegistrar(registry, handler);
    registrar.onModuleInit();

    expect(registry.has('game.rules')).toBe(true);
    expect(registry.has('game.rules.get')).toBe(false);
    expect(registry.has('game.rulebook')).toBe(false);
    expect(registry.has('game.actions')).toBe(false);
    expect(registry.has('game.rulebook.get')).toBe(false);
    expect(registry.has('rules')).toBe(false);
    expect(registry.has('game.modules')).toBe(true);
  });
});
