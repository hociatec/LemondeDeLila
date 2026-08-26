import { testGame } from '../../../core/application/public-api';
import { VILLAGE_ZONES } from './content';
import gameDefinition from './game';

describe('Mon Village, Mon Histoire declarative game', () => {
  it('uses deterministic components, collects cards and replays exactly', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(17);
    await game.start();

    await game.as(1).do('roll', {});

    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.view(1).collections[1]?.total).toBe(1);
    expect(game.view(1).positions[1]).toBeGreaterThan(0);
    expect(game.replay()).toEqual(game.state());
  });

  it('loads every declared zone and exposes only aggregate deck counts', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(5);
    await game.start();

    const view = game.view(1);
    expect(Object.keys(view.availableCards)).toHaveLength(VILLAGE_ZONES.length);
    expect(JSON.stringify(view)).not.toContain('decks');
  });
});
