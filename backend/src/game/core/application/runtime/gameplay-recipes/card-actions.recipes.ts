import type { GameActionDefinition } from '../game-definition';
import { defineAction } from '../game-definition';
import { gameInput } from '../game-input-schema';
import { cardEventIdentity } from './card-recipe.helpers';

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

type CardRequestOptions<TState extends object> = {
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
};

export function requestCardFromPlayer<TState extends object>(
  options: CardRequestOptions<TState>,
): GameActionDefinition<TState, { cardId: string; targetPlayerId: number }> {
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
