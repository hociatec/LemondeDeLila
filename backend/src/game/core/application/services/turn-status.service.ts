import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../models/game-state.model';

export type TurnStatusKey = string;

@Injectable()
export class TurnStatusService {
  setStatus(
    state: GameStateEntity,
    playerId: number,
    key: TurnStatusKey,
    value: number,
  ): GameStateEntity {
    const metadata = this.asRecord(state.metadata);
    const statuses = this.asRecord(metadata.statuses);
    const playerStatuses = this.asRecord(statuses[key]);
    const updatedStatuses = {
      ...statuses,
      [key]: { ...playerStatuses, [playerId]: value },
    };
    return { ...state, metadata: { ...metadata, statuses: updatedStatuses } };
  }

  getStatus(
    state: GameStateEntity,
    playerId: number,
    key: TurnStatusKey,
  ): number {
    const metadata = this.asRecord(state.metadata);
    const statuses = this.asRecord(metadata.statuses);
    const playerStatuses = this.asRecord(statuses[key]);
    const value = playerStatuses[playerId];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  decrement(state: GameStateEntity, key: TurnStatusKey): GameStateEntity {
    const metadata = this.asRecord(state.metadata);
    const statuses = this.asRecord(metadata.statuses);
    const playerStatuses = this.asRecord(statuses[key]);
    const updated: Record<number, number> = {};
    Object.entries(playerStatuses).forEach(([pid, val]) => {
      const numPid = Number(pid);
      const count = typeof val === 'number' && Number.isFinite(val) ? val : 0;
      const next = Math.max(0, count - 1);
      if (next > 0 && Number.isFinite(numPid)) updated[numPid] = next;
    });
    const merged = { ...statuses, [key]: updated };
    return { ...state, metadata: { ...metadata, statuses: merged } };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
