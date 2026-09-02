import {
  createMovementKitState,
  GameMovementController,
  movement,
} from './movement-kit';

describe('GameMovementController', () => {
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

    expect(
      events.find(
        (event) => event.type === 'pawn.landed' && event.data.tileLabel != null,
      )?.data,
    ).toEqual(
      expect.objectContaining({
        position: 3,
        tileLabel: 'Clairière enchantée',
        tileDescription: 'Des lucioles éclairent le chemin.',
      }),
    );
  });
});
