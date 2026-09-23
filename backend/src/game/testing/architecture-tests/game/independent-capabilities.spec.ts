import {
  defineGame,
  defineAction,
  gameInput,
} from '../../../engine/sdk/public-api';
import { testGame } from '../../../engine/testing/public-api';
import { consumeFirstProtection } from '../../../rules/recipes/protection-cost';
import { settleResourceDelta } from '../../../rules/recipes/resource-settlement';

// A second composition: exhaustion awards fatigue, never bankruptcy or a race win.
const expedition = defineGame<Record<string, never>>()({
  id: 'energy-expedition',
  displayName: 'Energy expedition',
  category: 'test',
  players: { min: 2, max: 2 },
  resourceIds: ['energy', 'supplies', 'fatigue'],
  initialization: {
    firstPlayer: 'first',
    resources: { energy: 3, supplies: 1, fatigue: 0 },
  },
  initialPhase: 'playing',
  phases: { playing: { actions: ['prepare', 'explore'], terminal: true } },
  actions: {
    prepare: defineAction<Record<string, never>, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) =>
        ctx.status.add(actor.id, 'shelter', { scope: 'until-used' }),
    }),
    explore: defineAction<Record<string, never>, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        if (
          consumeFirstProtection(ctx, actor.id, [
            { status: 'shelter' },
            { resource: 'supplies', amount: 1 },
          ]) !== undefined
        )
          return;
        settleResourceDelta(ctx.resources, actor.id, 'energy', -5, {
          minimum: 0,
          onShortfall: (missing) => {
            ctx.resources.add(actor.id, 'fatigue', missing);
          },
        });
      },
    }),
  },
});

it('composes protection, cost and deficit policy without any game-specific pack', async () => {
  const game = testGame(expedition).players(2).seed(11);
  await game.start();
  await game.as(1).do('prepare', {});
  await game.as(1).do('explore', {});
  expect(game.resource(1, 'supplies')).toBe(1);
  expect(game.resource(1, 'energy')).toBe(3);
  await game.as(1).do('explore', {});
  expect(game.resource(1, 'supplies')).toBe(0);
  expect(game.resource(1, 'energy')).toBe(3);
  await game.as(1).do('explore', {});
  expect(game.resource(1, 'energy')).toBe(0);
  expect(game.resource(1, 'fatigue')).toBe(2);
  expect(game.resource(2, 'energy')).toBe(3);
  expect(game.resource(2, 'fatigue')).toBe(0);
  expect(game.player(1).alive).not.toBe(false);
  expect(await game.replay()).toEqual(game.state());
});
