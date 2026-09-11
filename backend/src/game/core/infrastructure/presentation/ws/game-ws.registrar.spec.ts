import { WsRouteRegistry } from '../../../../../platform/realtime/public-api';
import { GameWsRegistrar } from './game-ws.registrar';

describe('GameWsRegistrar', () => {
  it('registers only the official game routes', () => {
    const registry = new WsRouteRegistry();
    const register = jest.spyOn(registry, 'register');
    const handler = {
      rules: jest.fn(async () => null),
      modules: jest.fn(async () => null),
    } as any;

    const registrar = new GameWsRegistrar(registry, handler);
    registrar.onModuleInit();
    expect(register.mock.calls.map(([route]) => route).sort()).toEqual([
      'game.action',
      'game.action.candidates',
      'game.join',
      'game.key',
      'game.modules',
      'game.ping',
      'game.rules',
      'game.state',
      'game.turn',
    ]);
    for (const route of [
      'game.debug',
      'game.snapshot',
      'game.snapshot.export',
      'game.snapshot.restore',
      'game.replay',
      'game.state.internal',
    ])
      expect(registry.has(route)).toBe(false);

    expect(registry.has('game.rules')).toBe(true);
    expect(registry.has('game.rules.get')).toBe(false);
    expect(registry.has('game.rulebook')).toBe(false);
    expect(registry.has('game.actions')).toBe(false);
    expect(registry.has('game.rulebook.get')).toBe(false);
    expect(registry.has('rules')).toBe(false);
    expect(registry.has('game.modules')).toBe(true);
  });
});
