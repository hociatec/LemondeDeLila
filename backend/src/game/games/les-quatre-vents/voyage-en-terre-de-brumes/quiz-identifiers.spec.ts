import { compileJsonGame } from '../../../engine/json/public-api';
import { testGame } from '../../../engine/testing/public-api';
import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

function withQuiz(label: string, answerId = 'answer-2') {
  const asset = structuredClone(catalogue) as unknown as {
    legend: Array<Record<string, unknown>>;
    tiles: Array<Record<string, unknown>>;
  };
  asset.legend = [
    {
      ...asset.legend[0],
      quiz: {
        choices: [
          { id: 'answer-1', label: 'La réponse affichée' },
          { id: 'answer-2', label },
        ],
        answerId,
        successDelta: 2,
      },
    },
  ];
  asset.tiles = asset.tiles.map((tile, index, tiles) => ({
    ...tile,
    type: index > 0 && index < tiles.length - 1 ? 'legend' : tile.type,
  }));
  const definition = compileJsonGame(manifest, document, {
    'content/catalogue.json': asset,
  });
  return testGame(definition).players(2).seed(23);
}

it('rejects an answer ID absent from the displayed choices', () => {
  expect(() => withQuiz('Réponse', 'missing')).toThrow();
});

it.each(['Une traduction', 'La réponse affichée'])(
  'resolves and replays a quiz after its label changes to %s',
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
});
