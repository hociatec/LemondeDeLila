import type { PlayerStateEntity } from '../models/game-state.model';

export type RoundKitState = {
  number: number;
  status: 'idle' | 'playing' | 'finished';
  starterPlayerId: number | null;
  participantPlayerIds: number[];
  leftPlayerIds: number[];
  winnerPlayerIds: number[];
  completedRounds: number;
};

export function createRoundKitState(): RoundKitState {
  return {
    number: 0,
    status: 'idle',
    starterPlayerId: null,
    participantPlayerIds: [],
    leftPlayerIds: [],
    winnerPlayerIds: [],
    completedRounds: 0,
  };
}

export class GameRoundController {
  constructor(
    private readonly state: RoundKitState,
    private readonly players: readonly PlayerStateEntity[],
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
    private readonly lifecycle: {
      onStart?: (roundNumber: number) => void;
      onEnd?: (roundNumber: number) => void;
    } = {},
  ) {}

  get number(): number {
    return this.state.number;
  }

  status(): RoundKitState['status'] {
    return this.state.status;
  }

  completed(): number {
    return this.state.completedRounds;
  }

  starter(): number | null {
    return this.state.starterPlayerId;
  }

  participants(): number[] {
    return [...this.state.participantPlayerIds];
  }

  leftPlayers(): number[] {
    return [...this.state.leftPlayerIds];
  }

  winners(): number[] {
    return [...this.state.winnerPlayerIds];
  }

  start(
    starterPlayerId?: number,
    participantPlayerIds?: readonly number[],
  ): void {
    const active = this.players.filter((player) => player.alive !== false);
    const starter = starterPlayerId ?? active[0]?.id ?? null;
    const activeIds = new Set(active.map((player) => player.id));
    const participants = participantPlayerIds
      ? [...new Set(participantPlayerIds)].filter((playerId) =>
          activeIds.has(playerId),
        )
      : active.map((player) => player.id);
    this.state.number += 1;
    this.state.status = 'playing';
    this.state.starterPlayerId = starter;
    this.state.participantPlayerIds = participants;
    this.state.leftPlayerIds = [];
    this.state.winnerPlayerIds = [];
    this.emit('round.started', {
      number: this.state.number,
      starterPlayerId: starter,
      participantPlayerIds: [...participants],
    });
    this.lifecycle.onStart?.(this.state.number);
  }

  activePlayers(): PlayerStateEntity[] {
    const active = new Set(
      this.state.participantPlayerIds.filter(
        (playerId) => !this.state.leftPlayerIds.includes(playerId),
      ),
    );
    return this.players.filter((player) => active.has(player.id));
  }

  leave(playerId: number): void {
    if (!this.state.participantPlayerIds.includes(playerId)) return;
    if (!this.state.leftPlayerIds.includes(playerId)) {
      this.state.leftPlayerIds.push(playerId);
      this.emit('round.player-left', { playerId, number: this.state.number });
    }
  }

  winner(...playerIds: readonly number[]): void {
    this.state.winnerPlayerIds = [...new Set(playerIds)];
  }

  end(winnerPlayerIds = this.state.winnerPlayerIds): void {
    this.state.status = 'finished';
    this.state.winnerPlayerIds = [...new Set(winnerPlayerIds)];
    this.state.completedRounds += 1;
    this.emit('round.ended', {
      number: this.state.number,
      winnerPlayerIds: this.state.winnerPlayerIds,
    });
    this.lifecycle.onEnd?.(this.state.number);
  }

  next(): void {
    const active = this.players.filter((player) => player.alive !== false);
    const currentIndex = active.findIndex(
      (player) => player.id === this.state.starterPlayerId,
    );
    const next = active[(Math.max(0, currentIndex) + 1) % active.length];
    this.start(next?.id);
  }

  reset(): void {
    Object.assign(this.state, createRoundKitState());
  }
}
