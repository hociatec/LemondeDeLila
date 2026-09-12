import {
  createMovementKitState,
  GameMovementController,
  movement,
} from './movement-kit';

describe('GameMovementController', () => {
  it('rejects invalid players and unknown tracks without movement or events', () => {
    const state = createMovementKitState();
    const emit = jest.fn();
    const controller = new GameMovementController(state, emit);
    controller.createTrack(movement.track({ id: 'track', spaces: 4 }));
    const before = structuredClone(state);
    for (const playerId of [0, NaN, Infinity, 1.5])
      expect(() => controller.move('track', playerId, 1)).toThrow();
    expect(() => controller.position('missing', 1)).toThrow();
    expect(() => controller.positions('missing')).toThrow();
    expect(state).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
  });
  it('adds the reached tile narration to the landing event', () => {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const state = createMovementKitState();
    state.positions.track = { '1': 0 };
    const controller = new GameMovementController(
      state,
      (type, data) => events.push({ type, data }),
      [movement.track({ id: 'track', spaces: 4 })],
    );

    controller.moveAndResolve({
      trackId: 'track',
      playerId: 1,
      distance: 3,
      tiles: [
        { label: 'Départ' },
        { label: 'Pont' },
        { label: 'Forêt' },
        {
          title: 'Clairière enchantée',
          description: 'Des lucioles éclairent le chemin.',
        },
      ],
      onLand: () => {},
    });

    expect(events.find((event) => event.type === 'pawn.landed')?.data).toEqual(
      expect.objectContaining({
        position: 3,
        tileLabel: 'Clairière enchantée',
        tileDescription: 'Des lucioles éclairent le chemin.',
      }),
    );
    expect(events.filter((event) => event.type === 'pawn.landed')).toHaveLength(
      1,
    );
  });
});
