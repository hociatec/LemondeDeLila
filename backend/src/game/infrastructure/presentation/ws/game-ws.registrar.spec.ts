import { WsRouteRegistry } from '../../../../realtime/public-api';
import { GameWsRegistrar } from './game-ws.registrar';

describe('GameWsRegistrar', () => {
  it('registers rules + backward-compatible aliases', () => {
    const registry = new WsRouteRegistry();
    const handler = {
      rules: jest.fn(async () => null),
      modules: jest.fn(async () => null),
    } as any;

    const registrar = new GameWsRegistrar(registry, handler);
    registrar.onModuleInit();

    expect(registry.has('game.rules')).toBe(true);
    expect(registry.has('game.rules.get')).toBe(true);
    expect(registry.has('game.rulebook')).toBe(true);
    expect(registry.has('game.rulebook.get')).toBe(true);
    expect(registry.has('rules')).toBe(true);
    expect(registry.has('game.modules')).toBe(true);
  });
});
