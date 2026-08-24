import type { GameRulesAdapter } from '../../../application/contracts/game-rules-adapter.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameWsCommandMapper } from './game-ws-command.mapper';

describe('GameWsCommandMapper', () => {
  const mapper = new GameWsCommandMapper();

  it('normalizes legacy action shapes and keeps control fields out of payload', () => {
    const handler = {} as GameRulesAdapter;
    const state = {} as GameStateEntity;
    const actions = mapper.resolveActions(
      {
        roomId: 4,
        actionType: ' play ',
        card: 6,
        meta: { actorId: 999 },
      },
      12,
      handler,
      state,
    );

    expect(actions).toEqual([
      {
        type: 'play',
        payload: { card: 6 },
        meta: { actorId: 12 },
      },
    ]);
  });

  it('delegates validation with the authenticated actor', () => {
    const validated = { type: 'validated', payload: {} };
    const validateAction = jest.fn().mockReturnValue(validated);
    const handler = { validateAction } as unknown as GameRulesAdapter;
    const state = {} as GameStateEntity;

    const actions = mapper.resolveActions(
      { actions: [{ type: 'draw', payload: {} }] },
      7,
      handler,
      state,
    );

    expect(actions).toEqual([validated]);
    expect(validateAction).toHaveBeenCalledWith(
      state,
      { type: 'draw', payload: {}, meta: { actorId: 7 } },
      7,
    );
  });
});
