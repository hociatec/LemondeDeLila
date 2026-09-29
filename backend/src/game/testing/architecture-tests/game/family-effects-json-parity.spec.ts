import { createHash } from 'node:crypto';
import {
  DeclarativeGameRuntime,
  GameSimulator,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/les-mains-de-la-terre/manifest.json';
import documentSource from '../../../games/vents-dansants/les-mains-de-la-terre/game.json';
import catalogue from '../../../games/vents-dansants/les-mains-de-la-terre/catalogue.json';

it('plays and replays a deterministic family-effects match', async () => {
  const document = structuredClone(documentSource);
  const cards = catalogue.cards
    .filter((card) => card.type === 'metier' && card.family === 'tradition')
    .slice(0, 2);
  const cardIds = cards.map((card) => card.id);
  const pattern = document.patterns[0];
  Reflect.set(pattern, 'cards', cards);
  Reflect.set(pattern, 'familyIds', ['tradition']);
  const deck = document.components.find(
    (component) => component.component === 'cards.deck',
  );
  const hands = document.components.find(
    (component) => component.component === 'cards.hands',
  );
  const sets = document.components.find(
    (component) => component.component === 'cards.sets',
  );
  Reflect.set(deck ?? {}, 'cards', cardIds);
  Reflect.set(hands ?? {}, 'initial', 1);
  Reflect.set(hands ?? {}, 'initialDeferredCardIds', []);
  Reflect.set(sets ?? {}, 'sets', { tradition: [cardIds[0]] });
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': catalogue,
  });
  const game = await testGame(definition)
    .players(['Anne', 'Bob'])
    .seed(42)
    .start();
  const result = new GameSimulator().run(
    new DeclarativeGameRuntime(definition),
    game.state(),
    { maxCommands: 100, startAtMs: 1000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe('finished');
  expect(result.commands).toBe(2);
  const trace = result.events
    .filter((event) => event.type !== 'engine.state.committed')
    .map(({ type, data, visibility }) => ({ type, data, visibility }));
  expect(trace).toHaveLength(16);
  expect(createHash('sha256').update(JSON.stringify(trace)).digest('hex')).toBe(
    '8ec4d10121cc7e0c91625ba94f0257f7d1f6bd6e042fc0a4c993d19204713d3e',
  );
});
