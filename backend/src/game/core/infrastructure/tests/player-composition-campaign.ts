import { ok } from 'node:assert';
import type { DiscoveredGameDefinition } from '../../../composition/game-module-discovery';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import { FixedGameClock } from '../../application/models/game-execution-context.model';
import type { GameSingleActionDto } from '../../application/models/game-action.model';
import type { GameState } from '../../application/models/game-state.model';
import { GameExecutionScopeService } from '../../application/services/game-execution-scope.service';
import { GameCommandExecutorService } from '../../application/services/game-command-executor.service';
import { GameAutomationPlannerService } from '../../application/services/game-automation-planner.service';
import { BotRunnerService } from '../../application/services/bot-runner.service';
import { BotSettingsService } from '../../application/services/bot-settings.service';
import { drainPendingGameEvents } from '../../application/services/game-event-buffer';
import {
  createTestGameState,
  type TestPlayer,
} from '../../testing/game-test-state';

export function runCompositionCampaign(
  definition: DiscoveredGameDefinition,
  players: TestPlayer[],
  seed: number,
  maximumSteps = 64,
) {
  const scope = new GameExecutionScopeService();
  const executor = new GameCommandExecutorService(scope);
  const runtime = new DeclarativeGameRuntime(definition);
  const clock = new FixedGameClock(1_700_000_000_000);
  const runner = new BotRunnerService();
  // Bot decisions must use the same simulated clock as actions and deadlines.
  runner.suggestForHandler = (handler, current, playerId) =>
    handler?.getBotActions(
      current,
      playerId,
      scope.create(current, playerId, clock),
    ) ?? null;
  const planner = new GameAutomationPlannerService(runner, {
    getBotStartDelayMs: () => 10,
    getBotTurnDelayMs: () => 10,
    getBotDrawDelayMs: () => 10,
  } as BotSettingsService);
  const base = createTestGameState({
    definition,
    players,
    seed,
    startedAt: clock.nowIso(),
  });
  let state = scope.run(scope.create(base, null, clock), () =>
    runtime.hydrateInitialState(base, scope.create(base, null, clock)),
  );
  let humanActions = 0,
    botActions = 0,
    automaticActions = 0,
    steps = 0;
  for (; steps < maximumSteps && state.status !== 'finished'; steps++) {
    const before = structuredClone(state);
    const context = scope.create(state, null, clock);
    const plan = scope.run(context, () => planner.resolve(runtime, state));
    const humans = (state.players ?? [])
      .filter((player) => !player.isBot)
      .flatMap((player) =>
        runtime
          .getAvailableActions(
            state,
            player.id,
            scope.create(state, player.id, clock),
          )
          .map((action) => ({ actorId: player.id, action })),
      );
    assertSameJson(
      state,
      before,
      'Planning must not mutate the authoritative state',
    );
    let actions: GameSingleActionDto[], actorId: number | null;
    if (
      plan &&
      (plan.dueAtMs <= clock.nowMs() || !humans.length || steps % 2 === 0)
    ) {
      clock.advanceBy(Math.max(0, plan.dueAtMs - clock.nowMs()));
      actions = plan.actions;
      actorId = null;
      if (plan.signature.startsWith('bot:')) botActions += actions.length;
      else automaticActions += actions.length;
    } else {
      const human = humans[(seed + steps) % Math.max(1, humans.length)];
      ok(
        human,
        `${definition.id}: no human, bot or automatic action at step ${steps}; phase=${state.phase}, turn=${state.turn?.currentPlayerId}, pending=${state.pending?.playerId}`,
      );
      actions = [human.action];
      actorId = human.actorId;
      humanActions++;
    }
    try {
      // Bots enter through action metadata, humans through the authenticated actor.
      // Both paths must execute the same commands with exactly the same effects.
      const next = executor.execute({
        handler: runtime,
        state,
        actions,
        actorId,
        clock,
      });
      let explicit = structuredClone(state);
      for (const action of actions) {
        const metadataActor =
          typeof action.meta?.actorId === 'number' ? action.meta.actorId : null;
        explicit = executor.execute({
          handler: runtime,
          state: explicit,
          actions: [action],
          actorId: actorId ?? metadataActor,
          clock,
        });
      }
      assertSameJson(
        next,
        explicit,
        'Bot and explicit actor execution must agree',
      );
      assertSameJson(
        state,
        before,
        'Execution must not mutate the previous snapshot',
      );
      drainPendingGameEvents(next);
      state = JSON.parse(JSON.stringify(next)) as GameState;
      const ids = new Set((state.players ?? []).map((player) => player.id));
      if (state.turn?.currentPlayerId != null)
        ok(
          ids.has(state.turn.currentPlayerId),
          'Turn must belong to a seated player',
        );
      for (const player of state.players ?? []) {
        const view = runtime.exposeStateForUser(
          state,
          player.id,
          scope.create(state, player.id, clock),
        );
        ok(
          view && typeof view === 'object',
          'Every player must have a valid view',
        );
      }
    } catch (error) {
      throw new Error(
        `${definition.id} seed=${seed} step=${steps} actor=${actorId} actions=${JSON.stringify(actions)}: ${String(error)}`,
        { cause: error },
      );
    }
    clock.advanceBy(1);
  }
  return {
    steps,
    finished: state.status === 'finished',
    humanActions,
    botActions,
    automaticActions,
  };
}

function assertSameJson(left: unknown, right: unknown, message: string): void {
  ok(JSON.stringify(left) === JSON.stringify(right), message);
}
