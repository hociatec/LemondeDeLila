import type { GamePendingEvent } from '../application/models/game-event.model';
import { drainPendingGameEvents } from '../application/services/game-event-buffer';
import type { GameRuntime } from '../application/ports/game-runtime.port';
import type { GameSingleActionDto } from '../application/models/game-action.model';
import {
  FixedGameClock,
  StateGameRng,
} from '../application/models/game-execution-context.model';
import type { GameState } from '../application/models/game-state.model';
import { GameExecutionScopeService } from '../application/services/game-execution-scope.service';

export type GameSimulationStatus =
  'finished' | 'deadlock' | 'step-limit' | 'failed';

export type GameSimulationResult = {
  status: GameSimulationStatus;
  commands: number;
  simulatedDurationMs: number;
  winnerPlayerIds: number[];
  winningPlayerSlots: number[];
  eventFrequency: Record<string, number>;
  cardFrequency: Record<string, number>;
  error?: string;
  finalState: GameState;
  events: GamePendingEvent[];
};

export type GameSimulationReport = {
  games: number;
  finished: number;
  deadlocks: number;
  stepLimitReached: number;
  failed: number;
  averageCommands: number;
  averageDurationMs: number;
  victoriesByStartingSlot: Record<string, number>;
  eventFrequency: Record<string, number>;
  cardFrequency: Record<string, number>;
  results: GameSimulationResult[];
};

type RuntimeState = GameState & {
  engine?: {
    pendingEvents?: Array<{ type?: unknown; data?: unknown }>;
    match?: { result?: { winnerPlayerIds?: number[] } | null };
  };
};

type SimulationContext = {
  state: RuntimeState;
  clock: FixedGameClock;
  startedAtMs: number;
  maxCommands: number;
  events: GamePendingEvent[];
  eventFrequency: Record<string, number>;
  cardFrequency: Record<string, number>;
};

/** Headless deterministic runner for bot-vs-bot campaigns. */
export class GameSimulator {
  private readonly execution = new GameExecutionScopeService();

  run(
    runtime: GameRuntime,
    initialState: GameState,
    options: { maxCommands?: number; startAtMs?: number } = {},
  ): GameSimulationResult {
    const state = structuredClone(initialState) as RuntimeState;
    for (const player of state.players ?? []) player.isBot = true;
    const metadataStartAtMs = Date.parse(
      String(state.metadata?.roomStartedAt ?? ''),
    );
    const startedAtMs =
      options.startAtMs ??
      (Number.isFinite(metadataStartAtMs)
        ? metadataStartAtMs
        : 1_700_000_000_000);
    const context: SimulationContext = {
      state,
      clock: new FixedGameClock(startedAtMs),
      startedAtMs,
      maxCommands: Math.max(1, options.maxCommands ?? 2_000),
      events: [],
      eventFrequency: {},
      cardFrequency: {},
    };
    try {
      return this.runLoop(runtime, context);
    } catch (error) {
      const result = this.simulationResult(context, 'failed', 0);
      return {
        ...result,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private runLoop(
    runtime: GameRuntime,
    context: SimulationContext,
  ): GameSimulationResult {
    for (let commands = 0; commands < context.maxCommands; commands += 1) {
      this.collectEvents(
        context.state,
        context.events,
        context.eventFrequency,
        context.cardFrequency,
      );
      if (this.finished(context.state)) {
        return this.simulationResult(context, 'finished', commands);
      }

      const automatic = runtime.getAutomaticActions(context.state);
      if (automatic?.actions.length) {
        if (
          automatic.executeAtMs != null &&
          automatic.executeAtMs > context.clock.nowMs()
        ) {
          context.clock.advanceBy(
            automatic.executeAtMs - context.clock.nowMs(),
          );
        }
        context.state = this.apply(
          runtime,
          context.state,
          automatic.actions,
          context.clock,
        );
        continue;
      }

      const action = this.nextBotAction(runtime, context.state);
      if (!action) return this.simulationResult(context, 'deadlock', commands);
      context.state = this.apply(
        runtime,
        context.state,
        [action],
        context.clock,
      );
    }
    return this.simulationResult(context, 'step-limit', context.maxCommands);
  }

  private simulationResult(
    context: SimulationContext,
    status: GameSimulationStatus,
    commands: number,
  ): GameSimulationResult {
    return this.result(
      status,
      commands,
      context.clock.nowMs() - context.startedAtMs,
      context.state,
      context.eventFrequency,
      context.cardFrequency,
      context.events,
    );
  }

  runMany(
    runtime: GameRuntime,
    createInitialState: (simulationIndex: number) => GameState,
    options: {
      games?: number;
      maxCommands?: number;
      retainResults?: boolean;
    } = {},
  ): GameSimulationReport {
    const games = Math.max(1, Math.trunc(options.games ?? 1_000));
    const results = Array.from({ length: games }, (_entry, index) =>
      this.run(runtime, createInitialState(index), {
        maxCommands: options.maxCommands,
      }),
    );
    return {
      games,
      finished: results.filter((result) => result.status === 'finished').length,
      deadlocks: results.filter((result) => result.status === 'deadlock')
        .length,
      stepLimitReached: results.filter(
        (result) => result.status === 'step-limit',
      ).length,
      failed: results.filter((result) => result.status === 'failed').length,
      averageCommands:
        results.reduce((total, result) => total + result.commands, 0) / games,
      averageDurationMs:
        results.reduce(
          (total, result) => total + result.simulatedDurationMs,
          0,
        ) / games,
      victoriesByStartingSlot: mergeCounts(
        results.map((result) =>
          Object.fromEntries(
            result.winningPlayerSlots.map((slot) => [String(slot), 1]),
          ),
        ),
      ),
      eventFrequency: mergeCounts(
        results.map((result) => result.eventFrequency),
      ),
      cardFrequency: mergeCounts(results.map((result) => result.cardFrequency)),
      results: options.retainResults === false ? [] : results,
    };
  }

  private nextBotAction(
    runtime: GameRuntime,
    state: GameState,
  ): GameSingleActionDto | null {
    const players = state.players ?? [];
    const currentPlayerId = state.turn?.currentPlayerId;
    const ordered = [
      ...players.filter((player) => player.id === currentPlayerId),
      ...players.filter((player) => player.id !== currentPlayerId),
    ];
    for (const player of ordered) {
      const selected = runtime.getBotActions(state, player.id)?.[0];
      if (selected) {
        return {
          ...selected,
          meta: { ...(selected.meta ?? {}), actorId: player.id },
        };
      }
      const fallback = runtime.getAvailableActions(state, player.id)[0];
      if (fallback) {
        return {
          ...fallback,
          meta: { ...(fallback.meta ?? {}), actorId: player.id },
        };
      }
    }
    return null;
  }

  private apply(
    runtime: GameRuntime,
    state: RuntimeState,
    actions: readonly GameSingleActionDto[],
    clock: FixedGameClock,
  ): RuntimeState {
    let current = state;
    for (const candidate of actions) {
      const actorId = Number(candidate.meta?.actorId);
      const normalizedActorId = Number.isFinite(actorId)
        ? actorId
        : (current.turn?.currentPlayerId ?? null);
      const validated = runtime.validateAction(
        current,
        candidate,
        normalizedActorId,
      );
      const context = {
        actorId: normalizedActorId,
        commandId: `simulation:${current.version ?? 0}`,
        rng: new StateGameRng(current),
        clock,
      };
      current = this.execution.run(context, () =>
        runtime.applyActions(current, [validated], context),
      );
    }
    return current;
  }

  private collectEvents(
    state: RuntimeState,
    events: GamePendingEvent[],
    eventFrequency: Record<string, number>,
    cardFrequency: Record<string, number>,
  ): void {
    const pending = drainPendingGameEvents(state);
    events.push(...pending);
    for (const event of pending) {
      const type = typeof event.type === 'string' ? event.type : 'unknown';
      eventFrequency[type] = (eventFrequency[type] ?? 0) + 1;
      if (!event.data || typeof event.data !== 'object') continue;
      for (const [key, value] of Object.entries(event.data)) {
        if (!key.toLowerCase().includes('card') || typeof value !== 'string')
          continue;
        cardFrequency[value] = (cardFrequency[value] ?? 0) + 1;
      }
    }
  }

  private finished(state: RuntimeState): boolean {
    return (
      String(state.status).toLowerCase() === 'finished' ||
      state.engine?.match?.result != null
    );
  }

  private result(
    status: GameSimulationStatus,
    commands: number,
    simulatedDurationMs: number,
    state: RuntimeState,
    eventFrequency: Record<string, number>,
    cardFrequency: Record<string, number>,
    events: GamePendingEvent[],
  ): GameSimulationResult {
    this.collectEvents(state, events, eventFrequency, cardFrequency);
    const winnerPlayerIds = [
      ...(state.engine?.match?.result?.winnerPlayerIds ?? []),
    ];
    const playerIds = (state.players ?? []).map((player) => player.id);
    return {
      status,
      commands,
      simulatedDurationMs,
      winnerPlayerIds,
      winningPlayerSlots: winnerPlayerIds
        .map((playerId) => playerIds.indexOf(playerId) + 1)
        .filter((slot) => slot > 0),
      eventFrequency,
      cardFrequency,
      finalState: structuredClone(state),
      events: structuredClone(events),
    };
  }
}

function mergeCounts(
  counts: readonly Readonly<Record<string, number>>[],
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const entries of counts) {
    for (const [key, count] of Object.entries(entries)) {
      merged[key] = (merged[key] ?? 0) + count;
    }
  }
  return merged;
}
