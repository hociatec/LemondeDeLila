import { ok } from 'node:assert';
import type { GameRuntime } from '../../../core/application/ports/game-runtime.port';
import type { DiscoveredGameDefinition } from '../../../composition/game-module-discovery';
import type { GameSingleActionDto } from '../../../core/application/models/game-action.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import {
  FixedGameClock,
  type GameExecutionContext,
} from '../../../core/application/models/game-execution-context.model';
import { GameCommandExecutorService } from '../../../core/application/services/game-command-executor.service';
import { GameExecutionScopeService } from '../../../core/application/services/game-execution-scope.service';
import { drainPendingGameEvents } from '../../../core/application/services/game-event-buffer';
import { createTestGameState } from '../../../core/testing/game-test-state';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import { ContractGameRuntime } from './game-stability-auditor';
import { assertContentReferences } from './game-content-storage-auditor';
import type { DeclarativeState } from '../../../engine/runtime/definitions/game-definition';

type Candidate = { actorId: number | null; action: GameSingleActionDto };

export function runGameReplayCampaign(
  definition: DiscoveredGameDefinition,
  seed: number,
  maximumSteps = 64,
): { steps: number; actionTypes: string[]; finished: boolean } {
  const scope = new GameExecutionScopeService();
  const executor = new GameCommandExecutorService(scope);
  const clock = new FixedGameClock(1_700_000_000_000 + seed);
  const runtime = new ContractGameRuntime(definition);
  const replayRuntime = new DeclarativeGameRuntime(definition);
  let state = initialState(definition, runtime, seed, scope, clock);
  let replay = initialState(definition, replayRuntime, seed, scope, clock);
  assertSameJson(state, replay, 'Initial state differs for the same seed');
  assertCampaignState(runtime, state, clock);
  const types = new Set<string>();
  let steps = 0;
  for (; steps < maximumSteps && state.status !== 'finished'; steps++) {
    const before = structuredClone(state);
    const context = scope.create(state, null, clock);
    const candidate = scope.run(context, () =>
      selectCandidate(runtime, state, clock, seed + steps, context),
    );
    assertSameJson(state, before, 'Action enumeration mutated state');
    if (!candidate) break;
    const action = campaignCommand(candidate, seed, steps);
    try {
      const next = executor.execute({
        handler: runtime,
        state,
        actions: [action],
        actorId: candidate.actorId,
        clock,
      });
      const replayed = executor.execute({
        handler: replayRuntime,
        state: replay,
        actions: [structuredClone(action)],
        actorId: candidate.actorId,
        clock: new FixedGameClock(clock.nowMs()),
      });
      assertSameJson(
        next,
        replayed,
        'Replaying the same command produced a different state',
      );
      assertSameJson(state, before, 'Command mutated its input state');
      // The campaign invokes the command executor directly, so it must model
      // the persistence boundary that normally drains pending events.
      drainPendingGameEvents(next);
      drainPendingGameEvents(replayed);
      replay = roundTripSnapshot(replayed);
      state = next;
      assertCampaignState(runtime, state, clock);
      types.add(action.type);
      assertReplayedViews({
        runtime,
        replayRuntime,
        state,
        replay,
        scope,
        clock,
      });
    } catch (error) {
      throw new Error(
        `${definition.id} seed=${seed} step=${steps} actor=${candidate.actorId} action=${JSON.stringify(action)}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    clock.advanceBy(1000);
  }
  ok(steps > 0, `${definition.id}: campaign executed no command`);
  return {
    steps,
    actionTypes: [...types].sort(),
    finished: state.status === 'finished',
  };
}

function roundTripSnapshot(state: GameState): GameState {
  const restored = JSON.parse(JSON.stringify(state)) as GameState;
  assertSameJson(state, restored, 'Snapshot JSON round trip changed state');
  return restored;
}

function assertCampaignState(
  runtime: {
    assertStabilized(state: GameState, clock: FixedGameClock): void;
  },
  state: GameState,
  clock: FixedGameClock,
): void {
  runtime.assertStabilized(state, clock);
  assertContentReferences(state);
}

function campaignCommand(
  candidate: Candidate,
  seed: number,
  step: number,
): GameSingleActionDto {
  return {
    ...candidate.action,
    meta: { ...candidate.action.meta, commandId: `campaign:${seed}:${step}` },
  };
}

function initialState(
  definition: DiscoveredGameDefinition,
  handler: GameRuntime,
  seed: number,
  scope: GameExecutionScopeService,
  clock: FixedGameClock,
): GameState {
  const players = Array.from(
    { length: Math.max(2, definition.players.min) },
    (_, index) => `Player ${index + 1}`,
  ).slice(0, definition.players.max);
  const base = createTestGameState({
    definition,
    players,
    seed,
    startedAt: clock.nowIso(),
  });
  const context = scope.create(base, null, clock);
  return scope.run(context, () => handler.hydrateInitialState(base, context));
}

function assertReplayedViews(input: {
  runtime: GameRuntime;
  replayRuntime: GameRuntime;
  state: GameState;
  replay: GameState;
  scope: GameExecutionScopeService;
  clock: FixedGameClock;
}): void {
  const { runtime, replayRuntime, state, replay, scope, clock } = input;
  const beforeViews = structuredClone(state);
  for (const player of state.players ?? []) {
    assertSameJson(
      runtime.exposeStateForUser(
        state,
        player.id,
        scope.create(state, player.id, clock),
      ),
      replayRuntime.exposeStateForUser(
        replay,
        player.id,
        scope.create(replay, player.id, clock),
      ),
      'Replayed views differ',
    );
  }
  assertSameJson(state, beforeViews, 'Projection mutated state');
}

function selectCandidate(
  runtime: GameRuntime,
  state: GameState,
  clock: FixedGameClock,
  selector: number,
  execution: GameExecutionContext,
): Candidate | null {
  let candidates: Candidate[] = (state.players ?? []).flatMap((player) =>
    runtime
      .getAvailableActions(state, player.id, execution)
      .map((action) => ({ actorId: player.id, action })),
  );
  const automatic = runtime.getAutomaticActions?.(state);
  if (!candidates.length && !automatic?.actions.length) {
    candidates = candidatesAfterTimer(runtime, state, clock, execution);
  }
  if (
    automatic?.actions.length &&
    (candidates.length === 0 || selector % 7 === 0)
  ) {
    if (automatic.executeAtMs != null && automatic.executeAtMs > clock.nowMs())
      clock.advanceBy(automatic.executeAtMs - clock.nowMs());
    return { actorId: null, action: automatic.actions[0] };
  }
  return candidates[selector % Math.max(1, candidates.length)] ?? null;
}

function candidatesAfterTimer(
  runtime: GameRuntime,
  state: GameState,
  clock: FixedGameClock,
  execution: GameExecutionContext,
): Candidate[] {
  const timers = (state as DeclarativeState<object>).engine.scheduler.tasks;
  const deadlines = [
    ...new Set(Object.values(timers).map((timer) => timer.dueAtMs)),
  ]
    .filter((deadline) => deadline > clock.nowMs())
    .sort((left, right) => left - right);
  for (const deadline of deadlines) {
    clock.advanceBy(deadline - clock.nowMs());
    const candidates = (state.players ?? []).flatMap((player) =>
      runtime
        .getAvailableActions(state, player.id, execution)
        .map((action) => ({ actorId: player.id, action })),
    );
    if (candidates.length) return candidates;
  }
  return [];
}

/** Compare the persisted representation, independent of Jest/native object realms. */
function assertSameJson(left: unknown, right: unknown, message: string): void {
  const actual = JSON.stringify(left);
  const expected = JSON.stringify(right);
  if (actual === expected) return;
  let offset = 0;
  while (
    offset < Math.min(actual.length, expected.length) &&
    actual[offset] === expected[offset]
  )
    offset++;
  throw new Error(
    `${message}; offset ${offset}: ${actual.slice(offset, offset + 160)} <> ${expected.slice(offset, offset + 160)}`,
  );
}
