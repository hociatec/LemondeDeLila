import {
  GameRuleViolationError,
  GameStateViolationError,
} from '../../../core/domain/errors/game-domain.errors';
import type { PlayerStateEntity } from '../../../core/application/contracts/game-state.model';
import type {
  SubmissionEmitter,
  SubmissionKitState,
} from './submission-controller';

export class GameJudgeController {
  constructor(
    private readonly state: SubmissionKitState<unknown>,
    private readonly players: readonly PlayerStateEntity[],
    private readonly emit: SubmissionEmitter,
  ) {}

  has(id: string): boolean {
    return this.state.judges[id] != null;
  }

  start(
    id: string,
    options: { players?: readonly number[]; starterPlayerId?: number } = {},
  ): number {
    const known = new Set(this.players.map((player) => player.id));
    const playerIds = [
      ...new Set(options.players ?? this.players.map((player) => player.id)),
    ];
    if (
      playerIds.length === 0 ||
      playerIds.some((playerId) => !known.has(playerId))
    ) {
      throw new GameStateViolationError('Rotation de juge invalide', {
        id,
        playerIds,
      });
    }
    const starterIndex =
      options.starterPlayerId == null
        ? 0
        : playerIds.indexOf(options.starterPlayerId);
    this.state.judges[id] = {
      playerIds,
      index: Math.max(0, starterIndex),
    };
    const playerId = this.current(id);
    this.emit('judge.started', { id, playerId, playerIds: [...playerIds] });
    return playerId;
  }

  current(id: string): number {
    const rotation = this.require(id);
    const playerId =
      rotation.playerIds[rotation.index % rotation.playerIds.length];
    if (playerId == null) {
      throw new GameStateViolationError('Rotation de juge vide', { id });
    }
    return playerId;
  }

  next(id: string): number {
    const rotation = this.require(id);
    rotation.index = (rotation.index + 1) % rotation.playerIds.length;
    const playerId = this.current(id);
    this.emit('judge.changed', { id, playerId, index: rotation.index });
    return playerId;
  }

  setCurrent(id: string, playerId: number): number {
    const rotation = this.require(id);
    const index = rotation.playerIds.indexOf(playerId);
    if (index < 0) {
      throw new GameRuleViolationError('JUDGE_PLAYER_NOT_ALLOWED', {
        id,
        playerId,
      });
    }
    rotation.index = index;
    this.emit('judge.changed', { id, playerId, index });
    return playerId;
  }

  index(id: string): number {
    return this.require(id).index;
  }

  private require(id: string): { playerIds: number[]; index: number } {
    const rotation = this.state.judges[id];
    if (!rotation) {
      throw new GameStateViolationError('Rotation de juge absente', { id });
    }
    return rotation;
  }
}

/**
 * Pipeline commun collecte → reveal → vote/jury. Il compose les trois
 * contrôleurs spécialisés et porte la synchronisation des tours simultanés,
 * sans introduire de champs `roundStage` ou `pending*` dans l'état du jeu.
 */
