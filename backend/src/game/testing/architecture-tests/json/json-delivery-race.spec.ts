import { compileJsonGame } from '../../../rules/public-api';
import { testGame } from '../../../engine/testing/public-api';
import manifest from '../../../games/les-quatre-vents/taxi-express/manifest.json';
import documentSource from '../../../games/les-quatre-vents/taxi-express/game.json';
import clients from '../../../games/les-quatre-vents/taxi-express/content/clients.json';
import events from '../../../games/les-quatre-vents/taxi-express/content/events.json';

const document = structuredClone(documentSource);
const assets = {
  'content/clients.json': clients,
  'content/events.json': events,
};

it.each([
  { clientDeckId: 'missing' },
  { clientHandId: 'missing' },
  { eventDeckId: 'missing' },
  { destinationAttribute: 'missing' },
  { blockedPositionAttribute: 'missing' },
])('rejects invalid delivery race references %j', (change) => {
  const invalid = structuredClone(document);
  Object.assign(invalid.patterns[0].delivery, change);
  expect(() => compileJsonGame(manifest, invalid, assets)).toThrow();
});

it('delivers a client and finishes at the declared score', async () => {
  const candidate = structuredClone(document);
  candidate.patterns[0].spaces = 2;
  candidate.patterns[0].delivery.targetScore = 1;
  const definition = compileJsonGame(manifest, candidate, {
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
  });
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
