import { GameRankingController } from '../../../engine/runtime/kits/ranking-kit';
import { createContesResolution } from '../../../engine/runtime/extensions/contes/contes-resolution';

const resolution = createContesResolution({
  trackId: 'story-road',
} as never);

it.each([
  [1, 3, 2, 4, 5],
  [5, 4, 2, 3, 1],
])(
  'selects the closest player behind with an explicit ID tie-break: %j',
  (...ids) => {
    const positions: Record<number, number> = {
      1: 10,
      2: 8,
      3: 8,
      4: 10,
      5: 12,
    };
    const swap = jest.fn();
    resolution.swapClosestBehind(1, {
      players: { all: () => ids.map((id) => ({ id })) },
      movement: {
        position: (_track: string, id: number) => positions[id],
        swap,
      },
      ranking: new GameRankingController(),
    } as never);
    expect(swap).toHaveBeenCalledWith('story-road', 1, 2);
  },
);

it('does not swap when nobody is strictly behind', () => {
  const swap = jest.fn();
  resolution.swapClosestBehind(1, {
    players: { all: () => [{ id: 1 }, { id: 2 }] },
    movement: { position: () => 10, swap },
    ranking: new GameRankingController(),
  } as never);
  expect(swap).not.toHaveBeenCalled();
});
