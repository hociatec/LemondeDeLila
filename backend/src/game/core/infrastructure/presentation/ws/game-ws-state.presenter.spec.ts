import type { GameRuntime } from '../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameVisibilityService } from '../../../application/services/game-visibility.service';

describe('GameWsStatePresenter', () => {
  const createPresenter = () =>
    new GameWsStatePresenter(new GameVisibilityService());

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
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 2,
      gameType: 'example',
      version: 1,
      viewerPlayerId: 1,
    });
    const system = payload.system as { shortcuts: Array<{ key: string }> };
    expect(system.shortcuts.map((shortcut) => shortcut.key)).toEqual([
      'P',
      'S',
    ]);
    expect(payload.state).toBeUndefined();
  });

  it('publishes a server-driven configuration prompt without legacy rewriting', () => {
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
    const handler = {
      exposeStateForUser: () => state,
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 3,
      gameType: 'example',
      version: 1,
    });
    expect(payload.pending).toEqual(prompt);
  });

  it('preserves an explicit server mapping between pending choices and actions', () => {
    const mappedAction = { type: 'pick_beta', payload: { value: 2 } };
    const state = {
      status: 'started',
      phase: 'turn',
      turnIndex: 1,
      players: [{ id: 1, username: 'A' }],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      actions: [{ type: 'unrelated_action', payload: {} }, mappedAction],
      pending: {
        type: 'pick_one',
        playerId: 1,
        choices: ['Beta'],
        data: { choiceActionsByIndex: [mappedAction] },
      },
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => state,
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 5,
      gameType: 'opaque-game',
      version: 2,
      viewerPlayerId: 1,
    });
    expect((payload.pending as any).data.choiceActionsByIndex).toEqual([
      mappedAction,
    ]);
  });

  it('publishes the generic dice contract', () => {
    const state = {
      status: 'started',
      phase: 'turn',
      turn: { currentPlayerId: null, direction: 1, turnNumber: 3 },
      system: { turn: { number: 3 } },
      players: [],
      actions: [{ type: 'roll', payload: {} }],
      kits: { dice: { total: 5 } },
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => state,
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 4,
      gameType: 'dice-game',
      version: 8,
    });
    expect((payload.kits as any).dice).toEqual(
      expect.objectContaining({ total: 5, rollActionIndex: 0 }),
    );
    expect(payload.state).toBeUndefined();
  });
});
