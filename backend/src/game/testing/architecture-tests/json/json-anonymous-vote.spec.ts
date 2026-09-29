import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/nawak/manifest.json';
import source from '../../../games/vents-dansants/nawak/game.json';
import catalogue from '../../../games/vents-dansants/nawak/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { voteSubmissionId: 'choice-anonymous-vote.answers' },
  { targetScore: 0 },
  { eventNamespace: '' },
])('rejects invalid anonymous voting options %j', (mutation) => {
  const document = structuredClone(source);
  document.patterns[0] = {
    ...document.patterns[0],
    ...mutation,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('enumerates every configured answer and rejects an outside index', async () => {
  const document = structuredClone(source);
  const challenges = structuredClone(catalogue.challenges).map((challenge) => ({
    ...challenge,
    answers: ['a', 'b', 'c', 'd', 'e'],
  }));
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': { ...catalogue, challenges },
  });
  const game = await testGame(definition).players(3).seed(42).start();
  const choices = new DeclarativeGameRuntime(definition)
    .getAvailableActions(game.state(), 1)
    .filter((candidate) => candidate.payload?.answerIndex != null);
  expect(choices.map((candidate) => candidate.payload?.answerIndex)).toEqual([
    0, 1, 2, 3, 4,
  ]);
  await expect(
    game.as(1).do(choices[0].type, { answerIndex: 5 }),
  ).rejects.toThrow();
});
