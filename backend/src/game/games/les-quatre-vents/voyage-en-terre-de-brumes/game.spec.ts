import { testGame } from '../../../engine/testing/public-api';

import gameDefinition from './game';
import { parseVoyageCard, VOYAGE_CONTENT } from './content';

describe('Voyage structured content', () => {
  it('accepts presentation edits without deriving new effects', () => {
    const original = VOYAGE_CONTENT.farce[0];
    const translated = {
      ...original,
      effect: 'Advance three spaces',
      description: 'Updated presentation',
    };
    expect(() => parseVoyageCard(translated)).not.toThrow();
    expect(translated.effects).toEqual(original.effects);
  });

  it('rejects missing executable fields and invalid references', () => {
    const original = VOYAGE_CONTENT.farce[0];
    expect(() =>
      parseVoyageCard({ ...original, effects: undefined }),
    ).toThrow();
    expect(() =>
      parseVoyageCard({
        ...original,
        effects: [{ kind: 'custom', effectId: 'missing', data: {} }],
      }),
    ).toThrow();
    expect(() =>
      parseVoyageCard({
        ...original,
        quiz: { choices: ['A', 'B'], answer: 'C', successDelta: 2 },
      }),
    ).toThrow();
  });
});

describe('Voyage en Terre de Brumes declarative game', () => {
  it('moves deterministically and supports replay', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(23);
    await game.start();
    await game.as(1).do('roll', {});
    expect(game.state().game.lastRoll).not.toBeNull();
    expect(game.inspect.positions()[1]).toBeGreaterThan(0);
    expect(await game.replay()).toEqual(game.state());
  });

  it('does not expose internal choice state', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(27);
    await game.start();
    expect(JSON.stringify(game.view(1))).not.toContain('pendingChoice');
  });
});
