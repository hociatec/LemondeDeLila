import { GameWsCommandMapper } from './game-ws-command.mapper';

describe('GameWsCommandMapper', () => {
  const mapper = new GameWsCommandMapper();

  it.each([
    true,
    false,
    [],
    [1],
    '1e3',
    '2tail',
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects malformed room and version inputs %p', (value) => {
    expect(() => mapper.resolveRoomId({ roomId: value })).toThrow();
    expect(() =>
      mapper.resolveActions(
        { knownVersion: value, action: { type: 'roll' } },
        1,
      ),
    ).toThrow();
  });

  it('rejects removed legacy action shapes', () => {
    const actions = mapper.resolveActions(
      {
        roomId: 4,
        actionType: ' play ',
        card: 6,
        meta: { actorId: 999 },
      },
      12,
    );

    expect(actions).toEqual([]);
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

  it('discards client metadata reserved for internal scheduled actions', () => {
    expect(
      mapper
        .resolveActions(
          {
            commandId: 'envelope-command',
            knownVersion: 4,
            actions: [
              {
                type: 'roll',
                meta: { actorId: 999, schedulerId: 'due-task', extra: true },
              },
              {
                type: 'draw',
                meta: { commandId: 'own-command', knownVersion: 5 },
              },
            ],
          },
          7,
        )
        .map((action) => action.meta),
    ).toEqual([
      { actorId: 7, commandId: 'envelope-command:0', knownVersion: 4 },
      { actorId: 7, commandId: 'own-command', knownVersion: 5 },
    ]);
  });

  it('bounds action batches before decoding them', () => {
    const action = { type: 'roll' };
    expect(
      mapper.resolveActions({ actions: Array(128).fill(action) }, 7),
    ).toHaveLength(128);
    expect(() =>
      mapper.resolveActions({ actions: Array(129).fill(action) }, 7),
    ).toThrow('Trop de commandes');
  });

  it('bounds action types and does not treat arrays as records', () => {
    expect(() => mapper.resolveActions({ type: 'x'.repeat(129) }, 7)).toThrow();
    expect(
      mapper.resolveActions(
        { type: 'x'.repeat(128), payload: [], meta: [] },
        7,
      ),
    ).toEqual([{ type: 'x'.repeat(128), payload: {}, meta: { actorId: 7 } }]);
  });
});
