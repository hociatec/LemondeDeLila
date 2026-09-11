import type { testGame } from '../../../engine/testing/public-api';
import { VOYAGE_CONTENT, parseVoyageCard } from './content';
import type gameDefinition from './game';
import type { VoyageCard } from './types';

const quizCard: VoyageCard = {
  ...VOYAGE_CONTENT.legend[0],
  quiz: {
    choices: [
      { id: 'answer-1', label: 'La réponse affichée' },
      { id: 'answer-2', label: 'Une autre réponse' },
    ],
    answerId: 'answer-2',
    successDelta: 2,
  },
};

function withQuiz(label: string) {
  let definition!: typeof gameDefinition;
  let createGame!: typeof testGame;
  jest.isolateModules(() => {
    const catalogue = {
      ...structuredClone(VOYAGE_CONTENT),
      legend: [structuredClone(quizCard)],
      tiles: VOYAGE_CONTENT.tiles.map((tile, index, tiles) => ({
        ...tile,
        type: index > 0 && index < tiles.length - 1 ? 'legend' : tile.type,
      })),
    };
    catalogue.legend[0].quiz!.choices[1].label = label;
    jest.doMock('./catalogue.json', () => catalogue);
    createGame = jest.requireActual<{ testGame: typeof testGame }>(
      '../../../engine/testing/public-api',
    ).testGame;
    definition = jest.requireActual<{ default: typeof gameDefinition }>(
      './game',
    ).default;
  });
  jest.dontMock('./catalogue.json');
  return createGame(definition).players(2).seed(23);
}

it('validates answer IDs independently of labels and rejects duplicate or missing IDs', () => {
  const card = structuredClone(quizCard);
  card.quiz!.choices[1].label = card.quiz!.choices[0].label;
  expect(() => parseVoyageCard(card)).not.toThrow();
  card.quiz!.answerId = 'missing';
  expect(() => parseVoyageCard(card)).toThrow();
  card.quiz!.answerId = 'answer-1';
  card.quiz!.choices[1].id = 'answer-1';
  expect(() => parseVoyageCard(card)).toThrow();
});

it.each(['Une traduction', 'La réponse affichée'])(
  'resolves and replays a quiz after the correct label changes to %s',
  async (label) => {
    const game = withQuiz(label);
    await game.start();
    await game.as(1).do('roll', {});
    const position = game.inspect.positions()[1];
    expect(JSON.stringify(game.view(1))).toContain(label);
    await expect(game.choose(1, label)).rejects.toThrow();
    await game.choose(1, 'answer-2');
    expect(game.resource(1, 'voyage.collection.legend')).toBe(1);
    expect(game.inspect.positions()[1]).toBe(position + 2);
    expect(await game.replay()).toEqual(game.state());
  },
);

it('does not reward an incorrect answer ID', async () => {
  const game = withQuiz('Texte libre');
  await game.start();
  await game.as(1).do('roll', {});
  const position = game.inspect.positions()[1];
  await game.choose(1, 'answer-1');
  expect(game.resource(1, 'voyage.collection.legend')).toBe(0);
  expect(game.inspect.positions()[1]).toBe(position);
  expect(await game.replay()).toEqual(game.state());
});
