import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import document from './game.json';
import manifest from './manifest.json';
import catalogue from './content/catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Le Marché des Merveilles declarative game', () => {
  it('validates economy actions, persistent protection and replay', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();

    await game.as('Alice').do('buy', { good: 'ingredients' });
    expect(game.resource('Alice', 'coins')).toBe(9);
    expect(
      game
        .inventory('Alice', 'wonder-goods')
        .filter((item) => item === 'ingredients'),
    ).toHaveLength(1);
    await game.as('Bob').do('protect', {});
    const view = game.view('Bob') as unknown as {
      kits: { status: { byId: Record<string, Record<string, unknown>> } };
    };
    expect(view.kits.status.byId.protected?.['2']).toBeDefined();
    await game.as('Alice').do('sell', { good: 'ingredients' });
    expect(
      game
        .inventory('Alice', 'wonder-goods')
        .filter((item) => item === 'ingredients'),
    ).toHaveLength(0);
    expect(await game.replay()).toEqual(game.state());
  });
});
