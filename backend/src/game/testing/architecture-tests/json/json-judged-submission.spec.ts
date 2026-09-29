import { compileJsonGame } from '../../../rules/public-api';
import { testGame } from '../../../engine/testing/public-api';
import manifest from '../../../games/vents-dansants/les-absurdissimes/manifest.json';
import source from '../../../games/vents-dansants/les-absurdissimes/game.json';
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
  { revealedEvent: 'engine.state.committed' },
])('rejects an invalid judged-submission pattern %j', (mutation) => {
  const document = structuredClone(source);
  document.patterns[0] = {
    ...document.patterns[0],
    ...mutation,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('requires private hands, enough participants and a complete phase cycle', () => {
  expect(() =>
    compileJsonGame({ ...manifest, minPlayers: 1 }, source, assets),
  ).toThrow();
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...source,
        components: source.components.map((component) =>
          component.component === 'cards.hands'
            ? { ...component, visibility: 'public' }
            : component,
        ),
      },
      assets,
    ),
  ).toThrow();
});

it('rejects judge submissions and absent winners without mutation', async () => {
  const definition = compileJsonGame(manifest, source, assets);
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
});
