import type { PlayerStateEntity } from '../../../core/application/contracts/game-state.model';
import { GameNotFoundError } from '../../../core/domain/errors/game-domain.errors';

export type MatchLifecycleStatus =
  'waiting' | 'setup' | 'playing' | 'finished' | 'cancelled';

export type MatchPlayerStatus =
  'active' | 'eliminated' | 'left-round' | 'disconnected' | 'finished';

export type MatchResult = {
  winnerPlayerIds: number[];
  reason: string;
  ranking?: number[][];
};

export type MatchKitState = {
  status: MatchLifecycleStatus;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  result: MatchResult | null;
  playerStatuses: Record<string, MatchPlayerStatus>;
};

export function createMatchKitState(
  players: readonly PlayerStateEntity[],
  nowMs: number,
): MatchKitState {
  return {
    status: 'setup',
    startedAtMs: nowMs,
    finishedAtMs: null,
    result: null,
    playerStatuses: Object.fromEntries(
      players.map((player) => [String(player.id), 'active']),
    ),
  };
}

export class GameMatchController {
  constructor(
    private readonly state: MatchKitState,
    private readonly players: readonly PlayerStateEntity[],
    private readonly nowMs: () => number,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void,
    private readonly setRuntimeStatus: (status: MatchLifecycleStatus) => void,
  ) {}

  lifecycle(): MatchLifecycleStatus {
    return this.state.status;
  }

  start(): void {
    if (this.state.status === 'finished' || this.state.status === 'cancelled') {
      return;
    }
    this.state.status = 'playing';
    this.setRuntimeStatus('playing');
    this.state.startedAtMs ??= this.nowMs();
    this.emit('match.started', { startedAtMs: this.state.startedAtMs });
  }

  finish(result: {
    winners: readonly number[];
    reason: string;
    ranking?: readonly (readonly number[])[];
  }): void {
    if (this.state.status === 'finished') return;
    const winners = uniqueKnownPlayers(result.winners, this.players);
    this.state.status = 'finished';
    this.setRuntimeStatus('finished');
    this.state.finishedAtMs = this.nowMs();
    this.state.result = {
      winnerPlayerIds: winners,
      reason: result.reason,
      ...(result.ranking
        ? { ranking: result.ranking.map((rank) => [...rank]) }
        : {}),
    };
    for (const winner of winners) {
      this.state.playerStatuses[String(winner)] = 'finished';
    }
    this.emit('game.finished', {
      winnerPlayerIds: winners,
      reason: result.reason,
      finishedAtMs: this.state.finishedAtMs,
    });
  }

  cancel(reason: string): void {
    if (this.state.status === 'finished') return;
    this.state.status = 'cancelled';
    this.setRuntimeStatus('cancelled');
    this.state.finishedAtMs = this.nowMs();
    this.emit('match.cancelled', { reason });
  }

  eliminate(playerId: number, reason = 'rule'): void {
    this.assertPlayer(playerId);
    this.state.playerStatuses[String(playerId)] = 'eliminated';
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (player) player.alive = false;
    this.emit('player.eliminated', { playerId, reason });
  }

  setPlayerStatus(playerId: number, status: MatchPlayerStatus): void {
    this.assertPlayer(playerId);
    this.state.playerStatuses[String(playerId)] = status;
  }

  playerStatus(playerId: number): MatchPlayerStatus | null {
    return this.state.playerStatuses[String(playerId)] ?? null;
  }

  activePlayers(): PlayerStateEntity[] {
    return this.players.filter(
      (player) => this.playerStatus(player.id) === 'active',
    );
  }

  result(): MatchResult | null {
    return structuredClone(this.state.result);
  }

  private assertPlayer(playerId: number): void {
    if (!this.players.some((player) => player.id === playerId)) {
      throw new GameNotFoundError(`Joueur inconnu: ${playerId}`);
    }
  }
}

function uniqueKnownPlayers(
  playerIds: readonly number[],
  players: readonly PlayerStateEntity[],
): number[] {
  const known = new Set(players.map((player) => player.id));
  return [...new Set(playerIds)].filter((playerId) => known.has(playerId));
}
