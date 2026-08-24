import type { GameRulesAdapter } from '../../../application/contracts/game-rules-adapter.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameWsPayloadCompatibilityAdapter } from './game-ws-payload-compatibility.adapter';

describe('GameWsStatePresenter', () => {
  const createPresenter = () =>
    new GameWsStatePresenter(new GameWsPayloadCompatibilityAdapter());

  it('publishes only shortcuts whose actions are visible to the viewer', () => {
    const state = {
      status: 'started',
      phase: 'turn',
      turnIndex: 1,
      players: [{ id: 1, username: 'A' }],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => ({
        ...state,
        actions: [{ type: 'play', payload: { card: 3 } }],
      }),
      getShortcuts: () => [
        { key: 'P', type: 'action', actionType: 'play' },
        { key: 'Q', type: 'action', actionType: 'quit' },
        { key: 'S', type: 'interface', id: 'score' },
      ],
    } as unknown as GameRulesAdapter;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 2,
      gameType: 'example',
      version: 1,
      viewerPlayerId: 1,
    });
    const extras = payload.extras as { shortcuts: Array<{ key: string }> };
    expect(extras.shortcuts.map((shortcut) => shortcut.key)).toEqual([
      'P',
      'S',
    ]);
    expect((payload.state as Record<string, any>).extras.shortcuts).toEqual(
      extras.shortcuts,
    );
  });

  it('preserves a server-driven configuration prompt', () => {
    const prompt = {
      type: 'config_prompt',
      label: 'Configuration',
      data: {
        actionType: 'configure',
        fields: [{ key: 'score', label: 'Score', kind: 'number' }],
      },
    };
    const state = {
      status: 'started',
      phase: 'setup',
      turnIndex: 0,
      players: [],
      turn: { currentPlayerId: null, direction: 1 },
      metadata: {},
      pending: prompt,
      actions: [{ type: 'configure', payload: {} }],
    } as unknown as GameStateEntity;
    const handler = { exposeState: () => state } as unknown as GameRulesAdapter;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 3,
      gameType: 'example',
      version: 1,
    });
    expect(payload.pending).toEqual(prompt);
  });
});
