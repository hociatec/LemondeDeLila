import { legacyExtensionFixture } from '../../../engine/testing/public-api';
import {
  defineAction,
  defineGame,
  gameEffects,
  gameInput,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import catalogue from './catalogue.json';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';
const document = legacyExtensionFixture(
  documentExtensionSource,
  'directionalHazardRace',
);

const definition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

it('breaks simultaneous arrival ties by numeric ID, including bot IDs', async () => {
  const game = await testGame(
    defineGame<NoGameState>()({
      ...definition,
      bot: undefined,
      actions: {
        roll: defineAction<NoGameState, Record<string, never>>({
          input: gameInput.object({}),
          execute: ({ ctx }) => {
            for (const player of ctx.players.all())
              ctx.movement.moveTo(
                'directionalHazard',
                player.id,
                catalogue.tiles.length - 1,
              );
            ctx.effects.run(gameEffects.custom('race-hazard.mark-winner'));
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
