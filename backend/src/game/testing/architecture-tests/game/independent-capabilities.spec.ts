import {
  defineGame,
  defineAction,
  gameInput,
  defineChoice,
  movement,
} from '../../../engine/sdk/public-api';
import { testGame } from '../../../engine/testing/public-api';
import { consumeFirstProtection } from '../../../rules/recipes/protection-cost';
import { settleResourceDelta } from '../../../rules/recipes/resource-settlement';
import { firstOtherPlayerAt } from '../../../rules/recipes/track-collision';

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

it.each([3, 17, 41, 97])(
  'composes movement costs, collision protection, choices, phases and replay (seed=%i)',
  async (seed) => {
    const definition = defineGame<Record<string, never>>()({
      id: 'orthogonal-expedition',
      displayName: 'Orthogonal expedition',
      category: 'test',
      players: { min: 2, max: 2 },
      resourceIds: ['energy', 'shield'],
      components: [
        movement.track({ id: 'route', spaces: 5, overshoot: 'wrap' }),
      ],
      initialization: {
        firstPlayer: 'first',
        scores: 0,
        tracks: { route: 0 },
        resources: { energy: 20, shield: 1 },
      },
      initialPhase: 'travel',
      phases: {
        travel: { actions: ['travel', 'ask'], transitions: ['rest'] },
        rest: { actions: ['back'], transitions: ['travel'] },
      },
      actions: {
        travel: defineAction<Record<string, never>, { distance: number }>({
          input: gameInput.object({
            distance: gameInput.number({ integer: true, min: 1, max: 5 }),
          }),
          execute: ({ actor, input, ctx }) => {
            ctx.resources.remove(actor.id, 'energy', 1);
            ctx.movement.move('route', actor.id, input.distance);
            const target = firstOtherPlayerAt(
              ctx,
              'route',
              ctx.movement.position('route', actor.id),
              actor.id,
            );
            if (
              target !== undefined &&
              consumeFirstProtection(ctx, actor.id, [
                { resource: 'shield', amount: 1 },
              ]) === undefined
            )
              ctx.score.add(target, 1);
            ctx.phase.transitionTo('rest');
          },
        }),
        back: defineAction<Record<string, never>, Record<string, never>>({
          input: gameInput.object({}),
          execute: ({ ctx }) => ctx.phase.transitionTo('travel'),
        }),
        ask: defineAction<Record<string, never>, Record<string, never>>({
          input: gameInput.object({}),
          execute: ({ actor, ctx }) =>
            ctx.choice.confirm({ id: 'score', player: actor.id }),
        }),
      },
      choices: {
        score: defineChoice<Record<string, never>, boolean>({
          input: gameInput.boolean(),
          resolve: ({ actor, value, ctx }) => {
            if (value) ctx.score.add(actor.id, 2);
          },
        }),
      },
    });
    const game = await testGame(definition).players(2).seed(seed).start();
    let value = seed,
      position = 0,
      shield = 1,
      opponentScore = 0,
      score = 0;
    for (let step = 0; step < 12; step++) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      const distance = 1 + (value % 5);
      const before = game.state();
      await expect(game.as(1).do('back', {})).rejects.toThrow();
      expect(game.state()).toEqual(before);
      await game.as(1).do('travel', { distance });
      position = (position + distance) % 5;
      if (position === 0) {
        if (shield) shield--;
        else opponentScore++;
      }
      expect(game.state().phase).toBe('rest');
      expect(game.resource(1, 'energy')).toBe(19 - step);
      expect(game.resource(2, 'energy')).toBe(20);
      expect(game.resource(1, 'shield')).toBe(shield);
      expect(game.state()).toHaveProperty(
        'engine.kits.movement.positions.route.1',
        position,
      );
      await game.as(1).do('back', {});
      await game.as(1).do('ask', {});
      const accepted = value % 3 === 0;
      await game.choose(1, accepted);
      if (accepted) score += 2;
      expect(game.state()).toHaveProperty(
        'engine.playerValues.scores.1',
        score,
      );
      expect(game.state()).toHaveProperty(
        'engine.playerValues.scores.2',
        opponentScore,
      );
      expect(game.state().phase).toBe('travel');
    }
    expect(await game.replay()).toEqual(game.state());
  },
);

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
