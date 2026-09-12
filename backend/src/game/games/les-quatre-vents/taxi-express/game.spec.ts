import { testGame } from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import document from './game.json';
import manifest from './manifest.json';
import board from './content/board.json';
import clients from './content/clients.json';
import events from './content/events.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/board.json': board,
  'content/clients.json': clients,
  'content/events.json': events,
});

describe('Taxi Express declarative game', () => {
  it('runs the complete mission flow without leaking other clients', async () => {
    expect(board.tiles).toHaveLength(25);
    expect(clients.cards).toHaveLength(18);
    expect(events.cards).toHaveLength(25);
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('roll', {});
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(Array.isArray(kits.cards?.hands['taxi-clients'].byPlayer['1'])).toBe(
      true,
    );
    expect(kits.cards?.hands['taxi-clients'].byPlayer['2']).toEqual({
      count: 0,
    });
    expect(kits.cards?.discards.events.cards).toHaveLength(1);
    expect(await game.replay()).toEqual(game.state());
  });
});
