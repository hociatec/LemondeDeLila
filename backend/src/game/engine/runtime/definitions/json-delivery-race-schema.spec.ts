import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../testing/public-api';
import manifest from '../../../games/les-quatre-vents/taxi-express/manifest.json';
import document from '../../../games/les-quatre-vents/taxi-express/game.json';
import board from '../../../games/les-quatre-vents/taxi-express/content/board.json';
import clients from '../../../games/les-quatre-vents/taxi-express/content/clients.json';
import events from '../../../games/les-quatre-vents/taxi-express/content/events.json';

const assets = {
  'content/board.json': board,
  'content/clients.json': clients,
  'content/events.json': events,
};

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { clientDeckId: 'missing' },
  { clientHandId: 'missing' },
  { eventDeckId: 'missing' },
  { destinationAttribute: 'missing' },
  { blockedPositionAttribute: 'missing' },
])('rejects invalid delivery race references %j', (extension) => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        deliveryRace: { ...document.deliveryRace, ...extension },
      },
      assets,
    ),
  ).toThrow();
});

it('requires the delivery program and its victory to be paired', () => {
  expect(() =>
    compileJsonGame(
      manifest,
      { ...document, victory: { kind: 'score-at-least', amount: 5 } },
      assets,
    ),
  ).toThrow(/delivery race program and victory required together/);
});

it('delivers a client and finishes at the declared score', async () => {
  const definition = compileJsonGame(
    manifest,
    {
      ...document,
      patterns: [{ ...document.patterns[0], spaces: 2 }],
      deliveryRace: { ...document.deliveryRace, targetScore: 1 },
    },
    {
      'content/board.json': {
        version: 1,
        tiles: [
          { id: 1, title: 'Station' },
          { id: 2, title: 'Destination' },
        ],
      },
      'content/clients.json': {
        version: 1,
        cards: [
          {
            id: 1,
            name: 'Client',
            text: 'Destination',
            attributes: { destinationId: 2 },
          },
        ],
      },
      'content/events.json': {
        version: 1,
        cards: [
          {
            id: 1,
            name: 'Calme',
            text: 'Aucun obstacle',
            attributes: { blockedTileId: 99 },
          },
        ],
      },
    },
  );
  const game = await testGame(definition)
    .players(['Lila', 'Mina'])
    .seed(1)
    .start();
  await game.as(1).do('roll', {});
  expect(game.state().status).toBe('finished');
  expect(
    game.state().log.some(({ key }) => key === 'taxi.client.delivered'),
  ).toBe(true);
});
