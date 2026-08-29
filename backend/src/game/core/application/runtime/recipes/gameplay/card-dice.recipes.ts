import type { GameActionDefinition } from '../../definitions/game-definition';
import { defineAction } from '../../definitions/game-definition';
import { gameInput } from '../../actions/game-input-schema';
import type { DiceRollPolicy } from '../../kits/dice-kit';
import type { PawnDefinition } from '../../kits/pawn-kit';
import type { GameContext } from '../../game-rule-context';
import { cardEventIdentity } from './card-recipe.helpers';

export type DrawAndResolveOptions<TCard, TResult> = {
  deckId: string;
  playerId: number;
  recycle?: boolean;
  discard?: boolean | ((input: { card: TCard; result: TResult }) => boolean);
  eventData?: (card: TCard) => Record<string, unknown>;
  resolve: (card: TCard) => TResult;
};

export type DrawForPlayerOptions = {
  deckId: string;
  handId: string;
  playerId: number;
  count?: number;
  recycle?: boolean;
};

/** Pioche ciblée vers une main et enregistre sa provenance pour tout le tour. */
export function drawForPlayer<TState extends object, TCard>(
  ctx: GameContext<TState>,
  options: DrawForPlayerOptions,
): TCard[] {
  const drawn = ctx.cards.drawManyToHand<TCard>(
    options.deckId,
    options.handId,
    options.playerId,
    options.count ?? 1,
    { recycle: options.recycle },
  );
  const last = drawn.at(-1);
  ctx.effects.recordSource({
    playerId: options.playerId,
    deckId: options.deckId,
    ...cardEventIdentity(last),
  });
  return drawn;
}

/** Pioche d'événement sans main, avec recyclage et provenance standardisés. */
export function drawEvent<TState extends object, TCard>(
  ctx: GameContext<TState>,
  options: Omit<DrawForPlayerOptions, 'handId' | 'count'> & {
    discard?: boolean;
  },
): TCard | null {
  const card = options.recycle
    ? ctx.cards.drawOrRecycle<TCard>(options.deckId)
    : ctx.cards.draw<TCard>(options.deckId);
  ctx.effects.recordSource({
    playerId: options.playerId,
    deckId: options.deckId,
    ...cardEventIdentity(card),
  });
  if (card != null && options.discard) ctx.cards.discard(options.deckId, card);
  return card;
}

/**
 * Pioche une carte, publie sa provenance, résout sa règle puis applique le
 * cycle de défausse du CardsKit. Cette forme impérative est utilisable dans
 * les chaînes de cases et les effets, contrairement à la recipe d'action.
 */
export function drawAndResolve<TState extends object, TCard, TResult = void>(
  ctx: GameContext<TState>,
  options: DrawAndResolveOptions<TCard, TResult>,
): TResult | null {
  return ctx.cards.drawThenResolve<TCard, TResult>(
    options.deckId,
    (card) => {
      ctx.effects.recordSource({
        playerId: options.playerId,
        deckId: options.deckId,
        ...cardEventIdentity(card),
      });
      ctx.events.message('game.card.drawn', {
        playerId: options.playerId,
        deckId: options.deckId,
        ...cardEventIdentity(card),
        ...options.eventData?.(card),
      });
      return options.resolve(card);
    },
    {
      recycle: options.recycle,
      discard: options.discard,
    },
  );
}

export function sequentialPawnSelection<TState extends object>(options: {
  setId: string;
  choiceId: string;
  label?: (pawn: PawnDefinition) => string;
  complete: (input: { ctx: GameContext<TState> }) => void;
}): {
  request: (playerId: number, ctx: GameContext<TState>) => void;
  resolve: (playerId: number, pawnId: string, ctx: GameContext<TState>) => void;
} {
  const request = (playerId: number, ctx: GameContext<TState>): void => {
    const available = ctx.pawns.available(options.setId);
    ctx.choice.pawn({
      id: options.choiceId,
      player: playerId,
      options: available.map((pawn) => pawn.id),
      label: (pawnId) => {
        const pawn = available.find((candidate) => candidate.id === pawnId);
        return pawn
          ? (options.label?.(pawn) ?? pawn.label ?? pawn.name ?? pawn.id)
          : pawnId;
      },
    });
  };
  const resolve = (
    playerId: number,
    pawnId: string,
    ctx: GameContext<TState>,
  ): void => {
    ctx.pawns.assign(options.setId, playerId, pawnId);
    const next = ctx.players
      .all()
      .find(
        (player) =>
          ctx.pawns.assigned(options.setId, player.id).length <
          ctx.pawns.perPlayer(options.setId),
      );
    if (next) {
      ctx.turn.to(next.id);
      request(next.id, ctx);
      return;
    }
    options.complete({ ctx });
  };
  return Object.freeze({ request, resolve });
}

export function passTurn<TState extends object>(): GameActionDefinition<
  TState,
  Record<string, never>
> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    execute: ({ ctx }) => ctx.turn.end(),
    documentation: 'Passe le tour courant.',
  });
}

export function rollDice<TState extends object>(options: {
  diceId?: string;
  policy?: DiceRollPolicy;
  available?: GameActionDefinition<TState, Record<string, never>>['available'];
  documentation?: string;
  message?:
    | false
    | ((input: { playerId: number; total: number }) => {
        key: string;
        params?: Record<string, unknown>;
      });
  execute: (input: {
    state: TState;
    playerId: number;
    values: number[];
    total: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, Record<string, never>> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    available: options.available,
    execute: ({ state, actor, ctx }) => {
      const result = ctx.dice.rollWith(
        options.diceId ?? 'main',
        options.policy,
      );
      if (options.message !== false) {
        const message = options.message
          ? options.message({ playerId: actor.id, total: result.total })
          : {
              key: 'game.dice.rolled',
              params: {
                playerId: actor.id,
                diceId: options.diceId ?? 'main',
                total: result.total,
              },
            };
        ctx.events.message(message.key, message.params);
      }
      options.execute({
        state,
        playerId: actor.id,
        values: result.values,
        total: result.total,
        ctx,
      });
    },
    documentation:
      options.documentation ??
      'Lance les dés déclarés puis applique la règle du jeu.',
  });
}

export function rollAndMove<TState extends object>(options: {
  trackId: string;
  diceId?: string;
  policy?: DiceRollPolicy;
  available?: GameActionDefinition<TState, Record<string, never>>['available'];
  documentation?: string;
  message?:
    | false
    | ((input: { playerId: number; total: number }) => {
        key: string;
        params?: Record<string, unknown>;
      });
  winOnFinish?: { reason?: string };
  endTurn?: boolean;
  afterMove?: (input: {
    state: TState;
    playerId: number;
    values: number[];
    total: number;
    position: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, Record<string, never>> {
  return rollDice<TState>({
    diceId: options.diceId,
    policy: options.policy,
    available: options.available,
    documentation: options.documentation,
    message: options.message,
    execute: ({ state, playerId, values, total, ctx }) => {
      const position = ctx.movement.move(options.trackId, playerId, total);
      options.afterMove?.({
        state,
        playerId,
        values,
        total,
        position,
        ctx,
      });
      if (
        options.winOnFinish &&
        ctx.match.lifecycle() !== 'finished' &&
        ctx.movement.atFinish(options.trackId, playerId)
      ) {
        ctx.match.finish({
          winners: [playerId],
          reason: options.winOnFinish.reason ?? 'track-finished',
        });
      }
      if (options.endTurn && ctx.match.lifecycle() !== 'finished') {
        ctx.turn.complete();
      }
    },
  });
}

export function raceTurn<TState extends object>(options: {
  trackId: string;
  diceId?: string;
  policy?: DiceRollPolicy;
  available?: GameActionDefinition<TState, Record<string, never>>['available'];
  documentation?: string;
  message?:
    | false
    | ((input: { playerId: number; total: number }) => {
        key: string;
        params?: Record<string, unknown>;
      });
  winOnFinish?: { reason?: string };
  resolveLanding: (input: {
    state: TState;
    playerId: number;
    values: number[];
    total: number;
    position: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, Record<string, never>> {
  const { resolveLanding, ...rollOptions } = options;
  return rollAndMove<TState>({
    ...rollOptions,
    endTurn: true,
    afterMove: resolveLanding,
  });
}
