import { compileJsonGame } from '../../../engine/json/public-api';
import { testGame } from '../../../engine/testing/public-api';
import document from './game.json';
import manifest from './manifest.json';

const definition = compileJsonGame(manifest, document);

describe('Course des étoiles declarative game', () => {
  it('reaches the declared victory after three stars and replays it', async () => {
    const game = testGame(definition).players(['Lila', 'Mina']).seed(41);
    await game.start();

    for (const actor of [1, 2, 1, 2, 1]) {
      expect(game.availableActions(actor)).toContain('avancer');
      await game.as(actor).do('avancer', {});
    }

    expect(game.state().status).toBe('finished');
    expect(game.result()?.winnerPlayerIds).toEqual([1]);
    expect(await game.replay()).toEqual(game.state());
  });
});
