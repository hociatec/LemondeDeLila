import { compileJsonGame } from './json-game-compiler';
import { testGame, DeclarativeGameRuntime } from '../../testing/public-api';
import type { DeclarativeState } from '../state/declarative-state';
import manifest from '../../../games/vents-dansants/les-absurdissimes/manifest.json';
import document from '../../../games/vents-dansants/les-absurdissimes/game.json';
import cards from '../../../games/vents-dansants/les-absurdissimes/content/cards.json';

const assets = { 'content/cards.json': cards };

it.each([
  { promptDeckId: 'missing' },
  { answerDeckId: 'missing' },
  { answerHandId: 'missing' },
  { collectingPhase: 'missing' },
  { judgingPhase: 'play' },
  { scoreToWin: 0 },
  { botSelection: 'Math.random()' },
  { revealedEvent: 'card.received' },
  { revealedEvent: 'engine.state.committed' },
])('rejects an invalid judged-card program %j', (mutation) => {
  expect(() =>
    compileJsonGame(
      manifest,
      { ...document, judgedCards: { ...document.judgedCards, ...mutation } },
      assets,
    ),
  ).toThrow();
});

it('requires private hands, enough participants and a complete round graph', () => {
  expect(() =>
    compileJsonGame({ ...manifest, minPlayers: 1 }, document, assets),
  ).toThrow();
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        components: document.components.map((c) =>
          c.component === 'cards.hands' ? { ...c, visibility: 'public' } : c,
        ),
      },
      assets,
    ),
  ).toThrow();
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        phases: {
          ...document.phases,
          judge: { actions: ['judge_pick'], terminal: true },
        },
      },
      assets,
    ),
  ).toThrow();
});

it('does not let a player submit for the judge or choose an absent winner', async () => {
  const definition = compileJsonGame(manifest, document, assets);
  const game = await testGame(definition).players(3).seed(42).start();
  const first = game.player(2).hand[0];
  const before = structuredClone(game.state());
  await expect(game.as(1).do('play_card', { cardId: first })).rejects.toThrow();
  expect(game.state()).toEqual(before);
  await game.as(2).do('play_card', { cardId: first });
  await game.as(3).do('play_card', { cardId: game.player(3).hand[0] });
  const judging = structuredClone(game.state());
  await expect(
    game.as(1).do('judge_pick', { winnerId: 999 }),
  ).rejects.toThrow();
  expect(game.state()).toEqual(judging);
  const old = structuredClone(judging) as DeclarativeState<
    Record<string, never>
  >;
  old.engine.rulesVersion = '1';
  expect(() =>
    new DeclarativeGameRuntime(definition).applyActions(old, []),
  ).toThrow();
});
