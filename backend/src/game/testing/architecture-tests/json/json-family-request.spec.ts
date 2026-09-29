import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/dame-nature/manifest.json';
import documentSource from '../../../games/vents-dansants/dame-nature/game.json';
import catalogue from '../../../games/vents-dansants/dame-nature/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { deckId: 'missing' },
  { handId: 'missing' },
  { setsId: 'missing' },
  { pollutionCounter: 'missing' },
])('rejects invalid family-request references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[0] = {
    ...document.patterns[0],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('rejects an answer outside its quiz choices', () => {
  const document = structuredClone(documentSource);
  const cards = structuredClone(catalogue.cards);
  const quiz = cards.find((card) => card.type === 'quiz');
  if (!quiz || quiz.type !== 'quiz' || !quiz.choices)
    throw new Error('quiz missing');
  quiz.answerIndex = quiz.choices.length;
  expect(() =>
    compileJsonGame(manifest, document, {
      'content/catalogue.json': { ...catalogue, cards },
    }),
  ).toThrow(/Question invalide/);
});
