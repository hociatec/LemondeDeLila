import { parseJsonGame } from './json-game-parser';

describe('JSON parade schema', () => {
  it('rejects an empty sequence', () => {
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
        phases: { playing: { actions: ['play'], terminal: true } },
        actions: { play: { recipe: 'parade-play' } },
        victory: { kind: 'by-parade' },
        parade: {
          deckId: 'deck',
          handId: 'hand',
          cards: [{ id: 'one', name: 'One', value: '1', special: false }],
          sequence: [],
          rewards: {},
          resourceValues: {},
          finishReason: 'complete',
          eventNamespace: 'parade',
        },
      }),
    ).toThrow(/parade/);
  });
});
