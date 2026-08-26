import { GameWsCommandMapper } from './game-ws-command.mapper';

describe('GameWsCommandMapper', () => {
  const mapper = new GameWsCommandMapper();

  it('normalizes legacy action shapes and keeps control fields out of payload', () => {
    const actions = mapper.resolveActions(
      {
        roomId: 4,
        actionType: ' play ',
        card: 6,
        meta: { actorId: 999 },
      },
      12,
    );

    expect(actions).toEqual([
      {
        type: 'play',
        payload: { card: 6 },
        meta: { actorId: 12 },
      },
    ]);
  });

  it('binds every decoded action to the authenticated actor', () => {
    const actions = mapper.resolveActions(
      { actions: [{ type: 'draw', payload: {} }] },
      7,
    );

    expect(actions).toEqual([
      { type: 'draw', payload: {}, meta: { actorId: 7 } },
    ]);
  });
});
