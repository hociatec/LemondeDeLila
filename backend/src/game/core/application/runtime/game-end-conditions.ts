import type {
  AutomaticRule,
  VictoryRule,
} from './game-definition';
import type { GameContext } from './game-rule-context';

export type GameConditionInput<TState extends object> = {
  state: TState;
  ctx: GameContext<TState>;
};

export type GameCondition<TState extends object> = (
  input: GameConditionInput<TState>,
) => boolean;

export type GameTieBreaker<TState extends object> = {
  readonly direction?: 'asc' | 'desc';
  value(input: GameConditionInput<TState> & { playerId: number }): number;
};

export function defineTieBreaker<TState extends object>(
  tieBreaker: GameTieBreaker<TState>,
): GameTieBreaker<TState> {
  return Object.freeze(tieBreaker);
}

export function rankWithTieBreakers<TState extends object>(
  input: GameConditionInput<TState>,
  playerIds: readonly number[],
  tieBreakers: readonly GameTieBreaker<TState>[],
): number[][] {
  if (tieBreakers.length === 0) return [[...playerIds]];
  return input.ctx.ranking.tiers(
    playerIds,
    ...tieBreakers.map((criterion) => ({
      direction: criterion.direction,
      value: (playerId: number) => criterion.value({ ...input, playerId }),
    })),
  );
}

function selectedPlayers<TState extends object>(
  input: GameConditionInput<TState>,
  selection: 'current' | 'any' | 'all',
) {
  if (selection === 'current') {
    const current = input.ctx.players.current();
    return current ? [current] : [];
  }
  return input.ctx.players.active();
}

export const endConditions = Object.freeze({
  handEmpty<TState extends object>(options: {
    handId: string;
    players?: 'current' | 'any' | 'all';
  }): GameCondition<TState> {
    return (input) => {
      const selection = options.players ?? 'current';
      const players = selectedPlayers(input, selection);
      const empty = (playerId: number) =>
        input.ctx.cards.hand(options.handId, playerId).length === 0;
      return selection === 'all'
        ? players.length > 0 && players.every((player) => empty(player.id))
        : players.some((player) => empty(player.id));
    };
  },

  allPassed<TState extends object>(): GameCondition<TState> {
    return ({ ctx }) => {
      const participants = ctx.round.participants();
      const left = new Set(ctx.round.leftPlayers());
      return participants.length > 0 && participants.every((id) => left.has(id));
    };
  },

  deckEmpty<TState extends object>(deckId: string): GameCondition<TState> {
    return ({ ctx }) => ctx.cards.deckCount(deckId) === 0;
  },

  allAnswered<TState extends object>(sessionId: string): GameCondition<TState> {
    return ({ ctx }) => {
      const session = ctx.quiz.session(sessionId);
      return (
        session != null &&
        session.participantPlayerIds.every(
          (playerId) => session.answers[String(playerId)] != null,
        )
      );
    };
  },

  targetReached<TState extends object>(options: {
    target: number;
    value(input: GameConditionInput<TState>): number;
    direction?: 'at-least' | 'at-most';
  }): GameCondition<TState> {
    return (input) =>
      options.direction === 'at-most'
        ? options.value(input) <= options.target
        : options.value(input) >= options.target;
  },
});

export function endRoundWhen<TState extends object>(options: {
  id: string;
  condition: GameCondition<TState>;
  winners?: (input: GameConditionInput<TState>) => readonly number[];
  priority?: number;
}): AutomaticRule<TState> {
  return Object.freeze({
    id: options.id,
    priority: options.priority,
    when: (input) =>
      input.ctx.round.status() === 'playing' && options.condition(input),
    apply: (input) => {
      input.ctx.round.end(options.winners?.(input) ?? []);
    },
  });
}

function conditionVictory<TState extends object>(options: {
  condition: GameCondition<TState>;
  candidates: (input: GameConditionInput<TState>) => readonly number[];
  reason: string;
  tieBreakers?: readonly GameTieBreaker<TState>[];
}): VictoryRule<TState> {
  return {
    evaluate: (input) => {
      if (!options.condition(input)) return null;
      const candidates = [...new Set(options.candidates(input))];
      if (candidates.length === 0) return null;
      const ranking = rankWithTieBreakers(
        input,
        candidates,
        options.tieBreakers ?? [],
      );
      return {
        winnerPlayerIds: ranking[0] ?? candidates,
        reason: options.reason,
        ranking,
      };
    },
  };
}

export const victoryConditions = Object.freeze({
  scoreReached<TState extends object>(options: {
    target: number;
    tieBreakers?: readonly GameTieBreaker<TState>[];
  }): VictoryRule<TState> {
    return conditionVictory({
      condition: ({ ctx }) =>
        ctx.players.active().some((player) => ctx.score.get(player.id) >= options.target),
      candidates: ({ ctx }) =>
        ctx.players
          .active()
          .filter((player) => ctx.score.get(player.id) >= options.target)
          .map((player) => player.id),
      reason: 'score-reached',
      tieBreakers:
        options.tieBreakers ??
        [
          defineTieBreaker<TState>({
            value: ({ ctx, playerId }) => ctx.score.get(playerId),
          }),
        ],
    });
  },

  roundCount<TState extends object>(options: {
    rounds: number;
    tieBreakers: readonly GameTieBreaker<TState>[];
  }): VictoryRule<TState> {
    return conditionVictory({
      condition: ({ ctx }) => ctx.round.completed() >= options.rounds,
      candidates: ({ ctx }) => ctx.players.active().map((player) => player.id),
      reason: 'round-count',
      tieBreakers: options.tieBreakers,
    });
  },

  lastStanding<TState extends object>(): VictoryRule<TState> {
    return conditionVictory({
      condition: ({ ctx }) => ctx.match.activePlayers().length === 1,
      candidates: ({ ctx }) => ctx.match.activePlayers().map((player) => player.id),
      reason: 'last-player-standing',
    });
  },

  objectiveCompleted<TState extends object>(options: {
    completed(input: GameConditionInput<TState> & { playerId: number }): boolean;
    tieBreakers?: readonly GameTieBreaker<TState>[];
  }): VictoryRule<TState> {
    const candidates = (input: GameConditionInput<TState>) =>
      input.ctx.players
        .active()
        .filter((player) => options.completed({ ...input, playerId: player.id }))
        .map((player) => player.id);
    return conditionVictory({
      condition: (input) => candidates(input).length > 0,
      candidates,
      reason: 'objective-completed',
      tieBreakers: options.tieBreakers,
    });
  },

  trackFinished<TState extends object>(options: {
    trackId: string;
    tieBreakers?: readonly GameTieBreaker<TState>[];
  }): VictoryRule<TState> {
    const candidates = ({ ctx }: GameConditionInput<TState>) =>
      ctx.players
        .active()
        .filter((player) => ctx.movement.atFinish(options.trackId, player.id))
        .map((player) => player.id);
    return conditionVictory({
      condition: (input) => candidates(input).length > 0,
      candidates,
      reason: 'track-finished',
      tieBreakers: options.tieBreakers,
    });
  },
});
