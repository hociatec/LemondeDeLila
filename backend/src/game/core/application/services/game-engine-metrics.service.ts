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
      };
      this.metrics.set(gameType, metric);
    }
    return metric;
  }
}
