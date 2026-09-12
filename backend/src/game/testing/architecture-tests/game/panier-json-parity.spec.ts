import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from '../../../games/les-quatre-vents/panier-express/manifest.json';
import { resolveJsonContent } from '../../../engine/json/public-api';
import composition from '../../../games/les-quatre-vents/panier-express/game.json';
import board from '../../../games/les-quatre-vents/panier-express/content/board.json';
import cards from '../../../games/les-quatre-vents/panier-express/content/cards.json';
import pawns from '../../../games/les-quatre-vents/panier-express/content/pawns.json';
import products from '../../../games/les-quatre-vents/panier-express/content/products.json';
import quizzes from '../../../games/les-quatre-vents/panier-express/content/quizzes.json';
import reference from '../../fixtures/panier-before-json-parity.json';

const document = resolveJsonContent(composition, {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
  'content/products.json': products,
  'content/quizzes.json': quizzes,
});

// Captured from the previous TypeScript rules BEFORE replacing them with JSON.
it.each(reference)(
  'preserves the complete business event trace for seed $seed',
  async ({ seed, commands, events, sha256 }) => {
    const definition = compileJsonGame(manifest, document);
    const game = await testGame(definition)
      .players(['One', 'Two'])
      .seed(seed)
      .start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      { maxCommands: commands, startAtMs: 1000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe('deadlock');
    const trace = result.events
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(sha256);
  },
);
