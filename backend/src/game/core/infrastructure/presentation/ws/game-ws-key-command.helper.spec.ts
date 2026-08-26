import {
  normalizeGameKey,
  resolveGameLifecycleOperation,
  resolvePresentedGameKey,
} from './game-ws-key-command.helper';

describe('game websocket key commands', () => {
  const presented = {
    actions: [
      { type: 'draw', payload: { deck: 'main' } },
      { type: 'hidden_action', payload: { secret: true }, disabled: true },
    ],
    extras: {
      shortcuts: [
        { key: 'pressed SPACE', type: 'action', actionType: 'draw' },
        { key: 'H', type: 'action', actionType: 'hidden_action' },
        { key: 'C', type: 'interface', id: 'discard' },
      ],
      ui: {
        panels: {
          discard: { message: 'Carte au-dessus : 4.' },
        },
      },
    },
  };

  it('normalizes the same key vocabulary as the clients', () => {
    expect(normalizeGameKey(' pressed return ')).toBe('ENTER');
    expect(normalizeGameKey('backspace')).toBe('BACK');
  });

  it('resolves only an action exposed to the authenticated viewer', () => {
    expect(resolvePresentedGameKey(presented, 'space')).toEqual({
      kind: 'action',
      action: { type: 'draw', payload: { deck: 'main' } },
    });
    expect(resolvePresentedGameKey(presented, 'H')).toEqual({ kind: 'none' });
  });

  it('returns server-presented interface feedback', () => {
    expect(resolvePresentedGameKey(presented, 'C')).toEqual({
      kind: 'interface',
      panelId: 'discard',
      message: 'Carte au-dessus : 4.',
    });
  });

  it('never treats repeated Enter as a lifecycle command during a game', () => {
    expect(resolveGameLifecycleOperation('ENTER', 'started')).toBeNull();
    expect(resolveGameLifecycleOperation('ENTER', 'finished')).toBe('start');
    expect(resolveGameLifecycleOperation('X', 'started')).toBe('reset');
  });
});
