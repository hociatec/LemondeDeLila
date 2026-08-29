import type {
  AutomaticRule,
  GameActionDefinition,
  VictoryRule,
} from '../game-definition';
import { defineAction } from '../game-definition';
import { gameInput } from '../game-input-schema';
import type { GameInputSchema } from '../game-input-schema';

export function scoreUniqueCards<TCard>(
  cards: readonly TCard[],
  value: (card: TCard) => number,
): number {
  return [...new Set(cards)].reduce((total, card) => total + value(card), 0);
}

export function collectSets<TCard, TSetId extends string>(
  cards: readonly TCard[],
  setId: (card: TCard) => TSetId,
  required: Readonly<Record<TSetId, number>>,
): TSetId[] {
  const counts = new Map<TSetId, number>();
  for (const card of cards) {
    const id = setId(card);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return (Object.keys(required) as TSetId[]).filter(
    (id) => (counts.get(id) ?? 0) >= required[id],
  );
}

export function scoreHand<TCard>(
  cards: readonly TCard[],
  value: (card: TCard) => number,
): number {
  return cards.reduce((total, card) => total + value(card), 0);
}

export function completeSet<TState extends object>(options: {
  collectionId: string;
  score?: number;
  consume?: boolean;
  discard?: boolean;
  endTurn?: boolean;
  available?: GameActionDefinition<TState, { setId: string }>['available'];
  afterComplete?: (input: {
    state: TState;
    playerId: number;
    setId: string;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, { setId: string }> {
  return defineAction<TState, { setId: string }>({
    input: gameInput.object({ setId: gameInput.string({ min: 1 }) }),
    available: options.available,
    validate: ({ actor, input, ctx }) =>
      ctx.cards
        .completableSets(options.collectionId, actor.id)
        .includes(input.setId),
    enumerate: ({ actor, ctx }) =>
      ctx.cards
        .completableSets(options.collectionId, actor.id)
        .map((setId) => ({ setId })),
    execute: ({ state, actor, input, ctx }) => {
      const completed = ctx.cards.completeSet(
        options.collectionId,
        actor.id,
        input.setId,
        { consume: options.consume, discard: options.discard },
      );
      if (!completed) {
        ctx.reject('CARD_SET_INCOMPLETE', {
          collectionId: options.collectionId,
          playerId: actor.id,
          setId: input.setId,
        });
      }
      if (options.score) ctx.score.add(actor.id, options.score);
      options.afterComplete?.({
        state,
        playerId: actor.id,
        setId: input.setId,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation: 'Valide une famille complète et applique son score.',
  });
}

type SessionRecipeContext<TState extends object> = Parameters<
  GameActionDefinition<TState, never>['execute']
>[0]['ctx'];

function sessionIdFor<TState extends object>(
  sessionId:
    | string
    | ((input: {
        state: TState;
        playerId: number;
        ctx: SessionRecipeContext<TState>;
      }) => string),
  state: TState,
  playerId: number,
  ctx: SessionRecipeContext<TState>,
): string {
  return typeof sessionId === 'string'
    ? sessionId
    : sessionId({ state, playerId, ctx });
}

export function submitSecret<TState extends object, TValue>(options: {
  sessionId:
    | string
    | ((input: {
        state: TState;
        playerId: number;
        ctx: SessionRecipeContext<TState>;
      }) => string);
  value: GameInputSchema<TValue>;
  available?: GameActionDefinition<TState, { value: TValue }>['available'];
  afterSubmit?: (input: {
    state: TState;
    playerId: number;
    value: TValue;
    allSubmitted: boolean;
    ctx: SessionRecipeContext<TState>;
  }) => void;
}): GameActionDefinition<TState, { value: TValue }> {
  return defineAction<TState, { value: TValue }>({
    input: gameInput.object({ value: options.value }),
    available: (input) => {
      if (options.available && !options.available(input)) return false;
      const id = sessionIdFor(
        options.sessionId,
        input.state,
        input.actor.id,
        input.ctx,
      );
      return (
        input.ctx.submissions.has(id) &&
        input.ctx.submissions.pendingPlayers(id).includes(input.actor.id)
      );
    },
    execute: ({ state, actor, input, ctx }) => {
      const id = sessionIdFor(options.sessionId, state, actor.id, ctx);
      ctx.submissions.submit(id, actor.id, input.value);
      options.afterSubmit?.({
        state,
        playerId: actor.id,
        value: input.value,
        allSubmitted: ctx.submissions.isComplete(id),
        ctx,
      });
    },
    documentation:
      'Enregistre une soumission secrète sans la révéler aux autres joueurs.',
  });
}

export function vote<TState extends object, TValue>(options: {
  sessionId:
    | string
    | ((input: {
        state: TState;
        playerId: number;
        ctx: SessionRecipeContext<TState>;
      }) => string);
  value: GameInputSchema<TValue>;
  available?: GameActionDefinition<TState, { value: TValue }>['available'];
  afterVote?: (input: {
    state: TState;
    playerId: number;
    value: TValue;
    allVoted: boolean;
    ctx: SessionRecipeContext<TState>;
  }) => void;
}): GameActionDefinition<TState, { value: TValue }> {
  return defineAction<TState, { value: TValue }>({
    input: gameInput.object({ value: options.value }),
    available: (input) => {
      if (options.available && !options.available(input)) return false;
      const id = sessionIdFor(
        options.sessionId,
        input.state,
        input.actor.id,
        input.ctx,
      );
      return (
        input.ctx.submissions.has(id) &&
        input.ctx.submissions.pendingPlayers(id).includes(input.actor.id)
      );
    },
    execute: ({ state, actor, input, ctx }) => {
      const id = sessionIdFor(options.sessionId, state, actor.id, ctx);
      ctx.voting.vote(id, actor.id, input.value);
      options.afterVote?.({
        state,
        playerId: actor.id,
        value: input.value,
        allVoted: ctx.submissions.isComplete(id),
        ctx,
      });
    },
    documentation: 'Dépose un vote validé par la session VotingKit active.',
  });
}

export function revealSubmissions<TState extends object, TValue>(options: {
  sessionId: string;
  available?: GameActionDefinition<TState, Record<string, never>>['available'];
  afterReveal?: (input: {
    state: TState;
    playerId: number;
    valuesByPlayerId: Record<string, TValue>;
    ctx: SessionRecipeContext<TState>;
  }) => void;
}): GameActionDefinition<TState, Record<string, never>> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    available: (input) =>
      (!options.available || options.available(input)) &&
      input.ctx.submissions.has(options.sessionId) &&
      input.ctx.submissions.isComplete(options.sessionId),
    execute: ({ state, actor, ctx }) => {
      const valuesByPlayerId = ctx.submissions.reveal<TValue>(
        options.sessionId,
      );
      options.afterReveal?.({
        state,
        playerId: actor.id,
        valuesByPlayerId,
        ctx,
      });
    },
    documentation: 'Révèle une session complète de soumissions secrètes.',
  });
}

export function eliminateAtScore<TState extends object>(options: {
  score: (state: TState, playerId: number) => number;
  threshold: number;
  direction?: 'at-least' | 'at-most';
}): AutomaticRule<TState> {
  return {
    id: 'eliminate-at-score',
    when: ({ state, ctx }) =>
      ctx.players
        .active()
        .some((player) =>
          options.direction === 'at-most'
            ? options.score(state, player.id) <= options.threshold
            : options.score(state, player.id) >= options.threshold,
        ),
    apply: ({ state, ctx }) => {
      for (const player of ctx.players.active()) {
        const reached =
          options.direction === 'at-most'
            ? options.score(state, player.id) <= options.threshold
            : options.score(state, player.id) >= options.threshold;
        if (reached) ctx.match.eliminate(player.id, 'score-threshold');
      }
    },
  };
}

export function winAtScore<TState extends object>(
  target: number,
): VictoryRule<TState> {
  return {
    evaluate: ({ ctx }) => {
      const winners = ctx.score
        .leaders()
        .filter((playerId) => ctx.score.get(playerId) >= target);
      return winners.length > 0
        ? { winnerPlayerIds: winners, reason: 'score-target' }
        : null;
    },
  };
}

export function lastPlayerStanding<
  TState extends object,
>(): VictoryRule<TState> {
  return {
    evaluate: ({ ctx }) => {
      const active = ctx.match.activePlayers();
      return active.length === 1
        ? { winnerPlayerIds: [active[0].id], reason: 'last-player-standing' }
        : null;
    },
  };
}
