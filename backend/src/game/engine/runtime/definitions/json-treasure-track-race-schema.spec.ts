import { parseJsonGame } from './json-game-parser';

describe('JSON treasureTrack race schema', () => {
  it('rejects an invalid treasureTrack collection limit', () => {
    expect(() =>
      parseJsonGame({
        schemaVersion: 1,
        contentVersion: '1',
        definitionVersion: '1',
        category: 'test',
        world: 'test',
        components: [],
        setup: {},
        resourceIds: [],
        initialPhase: 'playing',
        phases: { playing: { actions: ['roll'], terminal: true } },
        actions: { roll: { recipe: 'race-treasure-track-roll' } },
        victory: { kind: 'by-treasure-track-race' },
        treasureTrackRace: {
          trackId: 'track',
          diceId: 'main',
          tiles: [],
          decks: { treasure: 'a', obstacle: 'b', bonus: 'c' },
          inventories: { treasure: 'a', obstacle: 'b', bonus: 'c' },
          goldResource: 'gold',
          obstacleImmunityStatus: 'immune',
          collectionLimit: 0,
          requiredTreasures: 3,
          requiredGold: 3,
          retreatSpaces: 2,
          finishReason: 'finished',
          stealEffectId: 'steal',
          eventNamespace: 'treasure-test',
        },
      }),
    ).toThrow(/treasureTrackRace/);
  });
});
