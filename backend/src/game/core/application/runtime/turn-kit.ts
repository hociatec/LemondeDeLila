import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../models/game-state.model';

export interface TurnPolicy {
  readonly kind: 'sequential' | 'simultaneous' | 'action-points';
  initialize(
    players: readonly PlayerStateEntity[],
  ): NonNullable<GameStateEntity['turn']>;
  advance(
    turn: NonNullable<GameStateEntity['turn']>,
    players: readonly PlayerStateEntity[],
  ): NonNullable<GameStateEntity['turn']>;
  actionPoints?: number;
}

export function standardTurn(): TurnPolicy {
  return clockwise();
}

export function clockwise(
  options: { skipEliminated?: boolean } = {},
): TurnPolicy {
  return sequentialPolicy(1, options.skipEliminated ?? true);
}

export function simultaneous(): TurnPolicy {
  return {
    kind: 'simultaneous',
    initialize: () => ({ currentPlayerId: null, direction: 1, turnNumber: 1 }),
    advance: (turn) => ({ ...turn, currentPlayerId: null }),
  };
}

export function actionPoints(options: { points: number }): TurnPolicy {
  const points = Math.max(1, Math.floor(options.points));
  const sequential = clockwise();
  return {
    kind: 'action-points',
    actionPoints: points,
    initialize: (players) => ({
      ...sequential.initialize(players),
      actionPointsRemaining: points,
    }),
    advance: (turn, players) => ({
      ...sequential.advance(turn, players),
      actionPointsRemaining: points,
    }),
  };
}

function sequentialPolicy(
  initialDirection: 1 | -1,
  skipEliminated: boolean,
): TurnPolicy {
  return {
    kind: 'sequential',
    initialize: (players) => ({
      currentPlayerId: eligible(players, skipEliminated)[0]?.id ?? null,
      direction: initialDirection,
      turnNumber: 1,
    }),
    advance: (turn, players) => {
      const candidates = eligible(players, skipEliminated);
      if (candidates.length === 0) return { ...turn, currentPlayerId: null };
      const currentIndex = candidates.findIndex(
        (player) => player.id === turn.currentPlayerId,
      );
      const direction = turn.direction ?? initialDirection;
      const nextIndex =
        (Math.max(0, currentIndex) + direction + candidates.length) %
        candidates.length;
      return {
        ...turn,
        currentPlayerId: candidates[nextIndex]?.id ?? null,
        turnNumber: (turn.turnNumber ?? 1) + 1,
      };
    },
  };
}

function eligible(
  players: readonly PlayerStateEntity[],
  skipEliminated: boolean,
): PlayerStateEntity[] {
  return players.filter((player) => !skipEliminated || player.alive !== false);
}
