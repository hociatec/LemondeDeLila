import {
  defineAction,
  defineGame,
  gameEffects,
  gameInput,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import catalogue from './catalogue.json';
import document from './game.json';
import manifest from './manifest.json';

const definition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

it('breaks simultaneous arrival ties by numeric ID, including bot IDs', async () => {
  const game = await testGame(
    defineGame<NoGameState>()({
      ...definition,
      actions: {
        roll: defineAction<NoGameState, Record<string, never>>({
          input: gameInput.object({}),
          execute: ({ ctx }) => {
            for (const player of ctx.players.all())
              ctx.movement.moveTo(
                'derape',
                player.id,
                catalogue.tiles.length - 1,
              );
            ctx.effects.run(gameEffects.custom('ca-derape.mark-winner'));
          },
        }),
      },
    }),
  )
    .players([
      { username: 'First', isBot: true },
      { username: 'Second', isBot: true },
    ])
    .start();
  await game.as(-1).do('roll', {});
  expect(game.result()?.winnerPlayerIds).toEqual([-2]);
  expect(await game.replay()).toEqual(game.state());
});
