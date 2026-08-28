import type {
  AutomaticRule,
  GameActionDefinition,
  VictoryRule,
} from './game-definition';
import { defineAction } from './game-definition';
import { gameInput } from './game-input-schema';
import type { GameInputSchema } from './game-input-schema';
import type { DiceRollPolicy } from './dice-kit';
import type { PawnDefinition } from './pawn-kit';
import type { GameContext } from './game-rule-context';
import type { GameEffectInstruction } from './effects-kit';

export type CompleteRoundOptions<TState extends object> = {
  winnerPlayerIds?: readonly number[];
  end?: boolean;
  score?: (input: { state: TState; ctx: GameContext<TState> }) => void;
  finishMatch?: (input: {
    state: TState;
    ctx: GameContext<TState>;
  }) => boolean | void;
  reset?: (input: { state: TState; ctx: GameContext<TState> }) => void;
  next?:
    | false
    | 'rotate'
    | { starterPlayerId: number }
    | ((input: { state: TState; ctx: GameContext<TState> }) => number | null);
};

export type TileDefinition<TTileType extends string = string> = {
  id: string | number;
  type?: TTileType;
  tags?: readonly string[];
  eventDeckId?: string;
  movement?: number;
  status?: string;
  effects?: readonly GameEffectInstruction[];
  quizId?: string;
};

export type TileResolutionInput<TState extends object, TTile> = {
  state: TState;
  trackId: string;
  playerId: number;
  tile: TTile;
  position: number;
  ctx: GameContext<TState>;
};

export type TileResolutionRule<TState extends object, TTile> = {
  type?: string;
  tag?: string;
  when?: (input: TileResolutionInput<TState, TTile>) => boolean;
  apply: (input: TileResolutionInput<TState, TTile>) => void;
};

export type EventTrackOptions<TState extends object, TTile> = {
  trackId: string;
  tiles: readonly TTile[];
  diceId?: string;
  policy?: DiceRollPolicy;
  endTurn?: boolean;
  maxLandingDepth?: number;
  rules?: readonly TileResolutionRule<TState, TTile>[];
  resolve?: (input: TileResolutionInput<TState, TTile>) => void;
};

export function resolveTile<TState extends object, TTile>(
  input: TileResolutionInput<TState, TTile> & {
    rules?: readonly TileResolutionRule<TState, TTile>[];
  },
): void {
  const tileRecord = input.tile as {
    type?: string;
    tags?: readonly string[];
    eventDeckId?: string;
    movement?: number;
    status?: string;
    effects?: readonly GameEffectInstruction[];
    quizId?: string;
  };
  for (const rule of input.rules ?? []) {
    if (rule.type && tileRecord.type !== rule.type) continue;
    if (rule.tag && !(tileRecord.tags ?? []).includes(rule.tag)) continue;
    if (rule.when && !rule.when(input)) continue;
    rule.apply(input);
  }
  if (tileRecord.eventDeckId) {
    drawEvent<TState, unknown>(input.ctx, {
      deckId: tileRecord.eventDeckId,
      playerId: input.playerId,
      recycle: true,
      discard: true,
    });
  }
  if (tileRecord.movement) {
    input.ctx.movement.move(input.trackId, input.playerId, tileRecord.movement);
  }
  if (tileRecord.status)
    input.ctx.status.add(input.playerId, tileRecord.status);
  if (tileRecord.effects?.length)
    input.ctx.effects.schedule(...tileRecord.effects);
}

export function eventTrackTurn<TState extends object, TTile>(
  options: EventTrackOptions<TState, TTile>,
): GameActionDefinition<TState, Record<string, never>> {
  return rollDice<TState>({
    diceId: options.diceId,
    policy: options.policy,
    execute: ({ state, playerId, total, ctx }) => {
      ctx.movement.moveAndResolve({
        trackId: options.trackId,
        playerId,
        distance: total,
        tiles: options.tiles,
        maxDepth: options.maxLandingDepth ?? 8,
        blocked: () => ctx.choice.current() != null,
        onLand: ({ position, tile }) => {
          if (tile == null) return;
          const input = {
            state,
            trackId: options.trackId,
            playerId,
            tile,
            position,
            ctx,
          };
          resolveTile({ ...input, rules: options.rules });
          options.resolve?.(input);
        },
      });
      if (options.endTurn ?? true) ctx.turn.complete();
    },
    documentation:
      'Lance le dé, avance sur une piste, résout la case atteinte et termine le tour si aucun workflow ne suspend la résolution.',
  });
}

/**
 * Pipeline unique de fin de manche: score, résultat de manche, résultat de
 * partie, reset puis sélection/démarrage du prochain starter.
 */
export function completeRound<TState extends object>(
  ctx: GameContext<TState>,
  options: CompleteRoundOptions<TState>,
): boolean {
  const input = { state: ctx.state, ctx };
  options.score?.(input);
  if (options.end !== false) {
    ctx.round.end([...(options.winnerPlayerIds ?? [])]);
  }
  const explicitlyFinished = options.finishMatch?.(input) === true;
  if (explicitlyFinished || ctx.match.lifecycle() === 'finished') return false;
  options.reset?.(input);
  if (options.next === false) return false;
  if (typeof options.next === 'function') {
    const starterPlayerId = options.next(input);
    if (starterPlayerId != null) ctx.round.start(starterPlayerId);
  } else if (options.next && options.next !== 'rotate') {
    ctx.round.start(options.next.starterPlayerId);
  } else {
    ctx.round.next();
  }
  return true;
}

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

function cardEventIdentity(card: unknown): Record<string, unknown> {
  if (card == null || typeof card !== 'object' || !('id' in card)) return {};
  const id = (card as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' ? { cardId: id } : {};
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

export function drawCard<TState extends object, TCard>(options: {
  deckId: string;
  handId: string;
  recycle?: boolean;
  available?: GameActionDefinition<TState, Record<string, never>>['available'];
  endTurn?: boolean;
  afterDraw?: (input: {
    state: TState;
    playerId: number;
    card: TCard;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, Record<string, never>> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    available: options.available,
    execute: ({ state, actor, ctx }) => {
      const card = ctx.cards.drawToHand<TCard>(
        options.deckId,
        options.handId,
        actor.id,
        { recycle: options.recycle },
      );
      if (card == null) {
        return ctx.reject('DECK_EMPTY', { deckId: options.deckId });
      }
      ctx.effects.recordSource({
        playerId: actor.id,
        deckId: options.deckId,
        ...cardEventIdentity(card),
      });
      options.afterDraw?.({
        state,
        playerId: actor.id,
        card,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation: 'Pioche une carte dans une main gérée par le CardsKit.',
  });
}

export function playCard<TState extends object>(options: {
  deckId: string;
  handId: string;
  available?: GameActionDefinition<TState, { cardId: string }>['available'];
  validate?: GameActionDefinition<TState, { cardId: string }>['validate'];
  enumerate?: GameActionDefinition<TState, { cardId: string }>['enumerate'];
  endTurn?: boolean;
  afterPlay?: (input: {
    state: TState;
    playerId: number;
    cardId: string;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, { cardId: string }> {
  return defineAction<TState, { cardId: string }>({
    input: gameInput.object({ cardId: gameInput.cardId() }),
    available: options.available,
    validate: options.validate,
    enumerate: options.enumerate,
    execute: ({ state, actor, input, ctx }) => {
      ctx.cards.play(options.handId, options.deckId, actor.id, input.cardId);
      options.afterPlay?.({
        state,
        playerId: actor.id,
        cardId: input.cardId,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation: 'Joue une carte possédée puis la place dans la défausse.',
  });
}

export function discardCard<TState extends object>(options: {
  deckId: string;
  handId: string;
  enumerate?: GameActionDefinition<TState, { cardId: string }>['enumerate'];
  validate?: GameActionDefinition<TState, { cardId: string }>['validate'];
  available?: GameActionDefinition<TState, { cardId: string }>['available'];
  afterDiscard?: (input: {
    state: TState;
    playerId: number;
    cardId: string;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  endTurn?: boolean;
}): GameActionDefinition<TState, { cardId: string }> {
  return defineAction<TState, { cardId: string }>({
    input: gameInput.object({ cardId: gameInput.cardId() }),
    available: options.available,
    validate:
      options.validate ??
      (({ actor, input, ctx }) =>
        ctx.cards
          .hand<string>(options.handId, actor.id)
          .includes(input.cardId)),
    enumerate:
      options.enumerate ??
      (({ actor, ctx }) =>
        ctx.cards
          .hand<string>(options.handId, actor.id)
          .map((cardId) => ({ cardId }))),
    execute: ({ state, actor, input, ctx }) => {
      ctx.cards.discardFromHand(
        options.handId,
        options.deckId,
        actor.id,
        input.cardId,
      );
      options.afterDiscard?.({
        state,
        playerId: actor.id,
        cardId: input.cardId,
        ctx,
      });
      if (options.endTurn ?? true) ctx.turn.complete();
    },
    documentation: 'Défausse une carte possédée.',
  });
}

export function drawThenResolve<TState extends object, TCard>(options: {
  deckId: string;
  recycle?: boolean;
  discard?: boolean;
  endTurn?: boolean;
  available?: GameActionDefinition<TState, Record<string, never>>['available'];
  resolve: (input: {
    state: TState;
    playerId: number;
    card: TCard;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
}): GameActionDefinition<TState, Record<string, never>> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    available: options.available,
    execute: ({ state, actor, ctx }) => {
      const resolved = ctx.cards.drawThenResolve<TCard, true>(
        options.deckId,
        (card) => {
          options.resolve({ state, playerId: actor.id, card, ctx });
          return true;
        },
        { recycle: options.recycle, discard: options.discard },
      );
      if (resolved == null) {
        ctx.reject('DECK_EMPTY', { deckId: options.deckId });
      }
      if (options.endTurn ?? true) ctx.turn.complete();
    },
    documentation:
      'Pioche une carte, résout immédiatement son effet puis applique le cycle du deck.',
  });
}

export function requestCardFromPlayer<TState extends object>(options: {
  handId: string;
  available?: GameActionDefinition<
    TState,
    { cardId: string; targetPlayerId: number }
  >['available'];
  requests: (input: {
    state: TState;
    playerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => Array<{ cardId: string; targetPlayerId: number }>;
  beforeRequest?: (input: {
    state: TState;
    playerId: number;
    cardId: string;
    targetPlayerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  onReceived?: (input: {
    state: TState;
    playerId: number;
    cardId: string;
    targetPlayerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  onMiss?: (input: {
    state: TState;
    playerId: number;
    cardId: string;
    targetPlayerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  endTurnOnReceived?: boolean;
  endTurnOnMiss?: boolean;
}): GameActionDefinition<TState, { cardId: string; targetPlayerId: number }> {
  const requestsFor = (
    state: TState,
    playerId: number,
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'],
  ) => options.requests({ state, playerId, ctx });
  return defineAction<TState, { cardId: string; targetPlayerId: number }>({
    input: gameInput.object({
      cardId: gameInput.cardId(),
      targetPlayerId: gameInput.playerId(),
    }),
    available: options.available,
    validate: ({ state, actor, input, ctx }) =>
      requestsFor(state, actor.id, ctx).some(
        (request) =>
          request.cardId === input.cardId &&
          request.targetPlayerId === input.targetPlayerId,
      ),
    enumerate: ({ state, actor, ctx }) => requestsFor(state, actor.id, ctx),
    execute: ({ state, actor, input, ctx }) => {
      const callbackInput = {
        state,
        playerId: actor.id,
        cardId: input.cardId,
        targetPlayerId: input.targetPlayerId,
        ctx,
      };
      options.beforeRequest?.(callbackInput);
      const received = ctx.cards
        .hand<string>(options.handId, input.targetPlayerId)
        .includes(input.cardId);
      if (received) {
        ctx.cards.transfer(
          options.handId,
          input.targetPlayerId,
          actor.id,
          input.cardId,
        );
        options.onReceived?.(callbackInput);
        if (options.endTurnOnReceived) ctx.turn.complete();
        return;
      }
      options.onMiss?.(callbackInput);
      if (options.endTurnOnMiss ?? true) ctx.turn.complete();
    },
    documentation:
      'Demande une carte autorisée à un autre joueur et gère automatiquement son transfert.',
  });
}

export function giveCard<TState extends object>(options: {
  handId: string;
}): GameActionDefinition<TState, { cardId: string; targetPlayerId: number }> {
  return defineAction<TState, { cardId: string; targetPlayerId: number }>({
    input: gameInput.object({
      cardId: gameInput.cardId(),
      targetPlayerId: gameInput.playerId(),
    }),
    validate: ({ actor, input, ctx }) =>
      input.targetPlayerId !== actor.id &&
      ctx.players.get(input.targetPlayerId) != null &&
      ctx.cards.hand<string>(options.handId, actor.id).includes(input.cardId),
    enumerate: ({ actor, ctx }) =>
      ctx.cards.hand<string>(options.handId, actor.id).flatMap((cardId) =>
        ctx.players.others(actor.id).map((target) => ({
          cardId,
          targetPlayerId: target.id,
        })),
      ),
    execute: ({ actor, input, ctx }) =>
      ctx.cards.transfer(
        options.handId,
        actor.id,
        input.targetPlayerId,
        input.cardId,
      ),
    documentation: 'Donne une carte possédée à un autre joueur.',
  });
}

export function stealCard<TState extends object>(options: {
  handId: string;
}): GameActionDefinition<TState, { targetPlayerId: number }> {
  return defineAction<TState, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    validate: ({ actor, input, ctx }) =>
      input.targetPlayerId !== actor.id &&
      ctx.cards.hand(options.handId, input.targetPlayerId).length > 0,
    enumerate: ({ actor, ctx }) =>
      ctx.players
        .others(actor.id)
        .filter(
          (player) => ctx.cards.hand(options.handId, player.id).length > 0,
        )
        .map((player) => ({ targetPlayerId: player.id })),
    execute: ({ actor, input, ctx }) => {
      ctx.cards.stealRandom(options.handId, input.targetPlayerId, actor.id);
    },
    documentation: 'Vole une carte aléatoire à un autre joueur.',
  });
}

export function swapHands<TState extends object>(options: {
  handId: string;
}): GameActionDefinition<TState, { targetPlayerId: number }> {
  return defineAction<TState, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    validate: ({ actor, input, ctx }) =>
      input.targetPlayerId !== actor.id &&
      ctx.players.get(input.targetPlayerId) != null,
    enumerate: ({ actor, ctx }) =>
      ctx.players
        .others(actor.id)
        .map((player) => ({ targetPlayerId: player.id })),
    execute: ({ actor, input, ctx }) =>
      ctx.cards.swapHands(options.handId, actor.id, input.targetPlayerId),
    documentation: 'Échange deux mains de cartes.',
  });
}

export function moveCurrentPlayer<TState extends object>(options: {
  trackId: string;
  spaces: number;
  endTurn?: boolean;
}): GameActionDefinition<TState, Record<string, never>> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    execute: ({ actor, ctx }) => {
      ctx.movement.move(options.trackId, actor.id, options.spaces);
      if (options.endTurn ?? true) ctx.turn.end();
    },
    documentation: 'Déplace le pion du joueur courant.',
  });
}

export function movePawn<TState extends object>(options: {
  trackId: string;
  enumerate: GameActionDefinition<
    TState,
    { playerId: number; distance: number }
  >['enumerate'];
  validate?: GameActionDefinition<
    TState,
    { playerId: number; distance: number }
  >['validate'];
  afterMove?: (input: {
    state: TState;
    playerId: number;
    distance: number;
    position: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  endTurn?: boolean;
}): GameActionDefinition<TState, { playerId: number; distance: number }> {
  return defineAction<TState, { playerId: number; distance: number }>({
    input: gameInput.object({
      playerId: gameInput.playerId(),
      distance: gameInput.number({ integer: true }),
    }),
    enumerate: options.enumerate,
    validate:
      options.validate ??
      (({ input, ctx }) => ctx.players.get(input.playerId) != null),
    execute: ({ state, input, ctx }) => {
      const position = ctx.movement.move(
        options.trackId,
        input.playerId,
        input.distance,
      );
      options.afterMove?.({
        state,
        playerId: input.playerId,
        distance: input.distance,
        position,
        ctx,
      });
      if (options.endTurn ?? true) ctx.turn.complete();
    },
    documentation: 'Déplace un pion autorisé sur une piste déclarée.',
  });
}

export function leaveRound<TState extends object>(): GameActionDefinition<
  TState,
  Record<string, never>
> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    execute: ({ actor, ctx }) => {
      ctx.round.leave(actor.id);
      ctx.turn.end();
    },
    documentation: 'Quitte la manche courante.',
  });
}

export function skipTurn<TState extends object>(
  options: {
    count?: number;
  } = {},
): GameActionDefinition<TState, { targetPlayerId: number }> {
  return defineAction<TState, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    validate: ({ input, ctx }) => ctx.players.get(input.targetPlayerId) != null,
    enumerate: ({ actor, ctx }) =>
      ctx.players
        .others(actor.id)
        .map((player) => ({ targetPlayerId: player.id })),
    execute: ({ input, ctx }) =>
      ctx.turn.skip(input.targetPlayerId, options.count ?? 1),
    documentation: 'Programme un ou plusieurs tours passés.',
  });
}

export function chooseTarget<TState extends object>(options: {
  targets: (input: {
    state: TState;
    playerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => readonly number[];
  available?: GameActionDefinition<
    TState,
    { targetPlayerId: number }
  >['available'];
  execute: (input: {
    state: TState;
    playerId: number;
    targetPlayerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  documentation?: string;
  endTurn?: boolean;
}): GameActionDefinition<TState, { targetPlayerId: number }> {
  const targetsFor = (
    state: TState,
    playerId: number,
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'],
  ) => options.targets({ state, playerId, ctx });
  return defineAction<TState, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    available: options.available,
    validate: ({ state, actor, input, ctx }) =>
      input.targetPlayerId !== actor.id &&
      targetsFor(state, actor.id, ctx).includes(input.targetPlayerId),
    enumerate: ({ state, actor, ctx }) =>
      targetsFor(state, actor.id, ctx).map((targetPlayerId) => ({
        targetPlayerId,
      })),
    execute: ({ state, actor, input, ctx }) => {
      options.execute({
        state,
        playerId: actor.id,
        targetPlayerId: input.targetPlayerId,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation:
      options.documentation ?? 'Choisit une cible légale puis résout l’effet.',
  });
}

export function answerQuiz<TState extends object>(options: {
  sessionId:
    | string
    | ((input: {
        state: TState;
        playerId: number;
        ctx: Parameters<
          GameActionDefinition<TState, never>['execute']
        >[0]['ctx'];
      }) => string);
  available?: GameActionDefinition<
    TState,
    { answerIndex: number }
  >['available'];
  afterAnswer?: (input: {
    state: TState;
    playerId: number;
    answerIndex: number;
    correct: boolean;
    allAnswered: boolean;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  endTurn?: boolean;
}): GameActionDefinition<TState, { answerIndex: number }> {
  const sessionIdFor = (
    state: TState,
    playerId: number,
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'],
  ) =>
    typeof options.sessionId === 'string'
      ? options.sessionId
      : options.sessionId({ state, playerId, ctx });
  return defineAction<TState, { answerIndex: number }>({
    input: gameInput.object({
      answerIndex: gameInput.number({ integer: true, min: 0 }),
    }),
    available: (input) => {
      if (options.available && !options.available(input)) return false;
      const session = input.ctx.quiz.session(
        sessionIdFor(input.state, input.actor.id, input.ctx),
      );
      return (
        session?.phase === 'answering' &&
        session.participantPlayerIds.includes(input.actor.id) &&
        session.answers[String(input.actor.id)] == null
      );
    },
    validate: ({ state, actor, input, ctx }) => {
      const session = ctx.quiz.session(sessionIdFor(state, actor.id, ctx));
      return (
        session != null &&
        input.answerIndex >= 0 &&
        input.answerIndex < session.question.choices.length
      );
    },
    enumerate: ({ state, actor, ctx }) => {
      const session = ctx.quiz.session(sessionIdFor(state, actor.id, ctx));
      return (
        session?.question.choices.map((_choice, answerIndex) => ({
          answerIndex,
        })) ?? []
      );
    },
    execute: ({ state, actor, input, ctx }) => {
      const result = ctx.quiz.answer(
        sessionIdFor(state, actor.id, ctx),
        actor.id,
        input.answerIndex,
      );
      options.afterAnswer?.({
        state,
        playerId: actor.id,
        answerIndex: input.answerIndex,
        correct: result.correct,
        allAnswered: result.allAnswered,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation: 'Répond à une session QuizKit active.',
  });
}

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
