import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../core/entities/game-state.entity';

export type TurnStatusKey = string;

@Injectable()
export class TurnStatusService {
  setStatus(
    state: GameStateEntity,
    playerId: number,
    key: TurnStatusKey,
    value: number,
  ): GameStateEntity {
    const metadata = state.metadata as any;
    const statuses = metadata?.statuses ?? {};
    const playerStatuses = statuses[key] ?? {};
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
    const metadata = state.metadata as any;
    return metadata?.statuses?.[key]?.[playerId] ?? 0;
  }

  decrement(state: GameStateEntity, key: TurnStatusKey): GameStateEntity {
    const metadata = state.metadata as any;
    const statuses = metadata?.statuses ?? {};
    const playerStatuses = statuses[key] ?? {};
    const updated: Record<number, number> = {};
    Object.entries(playerStatuses).forEach(([pid, val]) => {
      const next = Math.max(0, (val as number) - 1);
      if (next > 0) updated[pid as any] = next;
    });
    const merged = { ...statuses, [key]: updated };
    return { ...state, metadata: { ...metadata, statuses: merged } };
  }
}
