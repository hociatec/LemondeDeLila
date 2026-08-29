import {
  testGame,
  type StableGameKitsView,
} from '../../../engine/sdk/public-api';
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
