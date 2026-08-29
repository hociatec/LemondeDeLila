import { Injectable } from '@nestjs/common';

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

  recordCommand(gameType: string, accepted: boolean, durationMs: number): void {
    const metric = this.forGame(gameType);
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
    this.forGame(gameType).automaticActions += Math.max(0, Math.floor(count));
  }

  recordCommit(gameType: string, committed: boolean, stateBytes: number): void {
    const metric = this.forGame(gameType);
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
    const values = gameType
      ? [this.forGame(gameType)]
      : [...this.metrics.values()];
    return structuredClone(
      values.sort((left, right) => left.gameType.localeCompare(right.gameType)),
    );
  }

  private forGame(gameType: string): GameEngineMetricSnapshot {
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
