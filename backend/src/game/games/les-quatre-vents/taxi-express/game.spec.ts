import { testGame } from '../../../core/application/public-api';
import { TAXI_CLIENTS, TAXI_EVENTS, TAXI_TILES } from './content';
import gameDefinition from './game';

describe('Taxi Express declarative game', () => {
  it('runs the complete mission flow without leaking other clients', async () => {
    expect(TAXI_TILES).toHaveLength(25);
    expect(TAXI_CLIENTS).toHaveLength(18);
    expect(TAXI_EVENTS).toHaveLength(25);
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(137);
    await game.start();
    await game.as(1).do('roll', {});
    expect('activeClients' in game.view(1)).toBe(false);
    expect(game.replay()).toEqual(game.state());
  });
});
