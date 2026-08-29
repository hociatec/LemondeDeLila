import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
import { VILLAGE_ZONES } from './content';
import gameDefinition from './game';

describe('Mon Village, Mon Histoire declarative game', () => {
  it('uses deterministic components, collects cards and replays exactly', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(17);
    await game.start();

    await game.as(1).do('roll', {});

    expect(game.state().game.lastRoll).not.toBeNull();
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.collections.village.byPlayer['1']?.total).toBe(1);
    expect(game.view(1).positions[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('loads every declared zone and exposes only aggregate deck counts', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(5);
    await game.start();

    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(Object.keys(kits.cards?.decks ?? {})).toHaveLength(
      VILLAGE_ZONES.length,
    );
    expect(JSON.stringify(kits.cards?.decks)).not.toContain('title');
  });
});
