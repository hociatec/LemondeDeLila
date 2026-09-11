import { Injectable } from '@nestjs/common';
import { prometheusMetrics } from '../../../../platform/observability/public-api';

export type GameEngineMetricSnapshot = {
  gameType: string;
  commandsAccepted: number;
  commandsRejected: number;
  commandResolutionMs: { count: number; total: number; max: number };
  automaticActions: number;
  casConflicts: number;
  commits: number;
  latestStateBytes: number;
  largestStateBytes: number;
  timers: {
    scheduled: number;
    executed: number;
    cancelled: number;
    retried: number;
    deadLettered: number;
    totalLagMs: number;
    maxLagMs: number;
  };
};

@Injectable()
export class GameEngineMetricsService {
  private readonly metrics = new Map<string, GameEngineMetricSnapshot>();

  recordFailure(
    gameType: string,
    operation: 'command' | 'restore' | 'snapshot' | 'replay' | 'commit',
    error: unknown,
  ): void {
    const code =
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code.slice(0, 128)
        : 'INTERNAL_ERROR';
    prometheusMetrics.game.recordFailure(gameType, code, operation);
  }

  recordCommand(gameType: string, accepted: boolean, durationMs: number): void {
    const metric = this.forGame(gameType);
    durationMs =
      Number.isFinite(durationMs) && durationMs >= 0
        ? Math.min(durationMs, 86_400_000)
        : 0;
    if (accepted) metric.commandsAccepted += 1;
    else metric.commandsRejected += 1;
    metric.commandResolutionMs.count += 1;
    metric.commandResolutionMs.total += durationMs;
    metric.commandResolutionMs.max = Math.max(
      metric.commandResolutionMs.max,
      durationMs,
    );
  }

  recordAutomaticActions(gameType: string, count: number): void {
    this.forGame(gameType).automaticActions += Number.isFinite(count)
      ? Math.min(1_000_000, Math.max(0, Math.floor(count)))
      : 0;
  }

  recordCommit(gameType: string, committed: boolean, stateBytes: number): void {
    const metric = this.forGame(gameType);
    stateBytes =
      Number.isSafeInteger(stateBytes) && stateBytes >= 0
        ? Math.min(stateBytes, 1_073_741_824)
        : 0;
    if (committed) metric.commits += 1;
    else metric.casConflicts += 1;
    metric.latestStateBytes = stateBytes;
    metric.largestStateBytes = Math.max(metric.largestStateBytes, stateBytes);
  }

  recordTimerScheduled(gameType: string): void {
    this.forGame(gameType).timers.scheduled += 1;
  }

  recordTimerExecution(gameType: string, lagMs: number): void {
    const timers = this.forGame(gameType).timers;
    lagMs =
      Number.isFinite(lagMs) && lagMs >= 0 ? Math.min(lagMs, 86_400_000) : 0;
    timers.executed += 1;
    timers.totalLagMs += lagMs;
    timers.maxLagMs = Math.max(timers.maxLagMs, lagMs);
  }

  recordTimerCancelled(gameType: string): void {
    this.forGame(gameType).timers.cancelled += 1;
  }

  recordTimerFailure(gameType: string, terminal: boolean): void {
    const timers = this.forGame(gameType).timers;
    if (terminal) timers.deadLettered += 1;
    else timers.retried += 1;
  }

  snapshot(gameType?: string): GameEngineMetricSnapshot[] {
    const selected = gameType ? this.metrics.get(gameType) : undefined;
    const values = gameType
      ? selected
        ? [selected]
        : []
      : [...this.metrics.values()];
    return structuredClone(
      values.sort((left, right) => left.gameType.localeCompare(right.gameType)),
    );
  }

  private forGame(gameType: string): GameEngineMetricSnapshot {
    if (typeof gameType !== 'string') gameType = 'unknown';
    if (
      !/^[a-z][a-z0-9-]{0,95}$/.test(gameType) ||
      (!this.metrics.has(gameType) && this.metrics.size >= 128)
    )
      gameType = 'unknown';
    let metric = this.metrics.get(gameType);
    if (!metric) {
      metric = {
        gameType,
        commandsAccepted: 0,
        commandsRejected: 0,
        commandResolutionMs: { count: 0, total: 0, max: 0 },
        automaticActions: 0,
        casConflicts: 0,
        commits: 0,
        latestStateBytes: 0,
        largestStateBytes: 0,
        timers: {
          scheduled: 0,
          executed: 0,
          cancelled: 0,
          retried: 0,
          deadLettered: 0,
          totalLagMs: 0,
          maxLagMs: 0,
        },
      };
      this.metrics.set(gameType, metric);
    }
    return metric;
  }
}
