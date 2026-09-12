import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-contracts';
import { defineCardsSchema } from '../../cards/typed-cards';
import type { RitesProgram } from '../../contracts/rites-program';
import { defineEffect } from '../../effects/effects-core';
import { inventory } from '../../kits/inventory-kit';
import { cardGame } from '../../patterns/gameplay-pattern-track-card';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import {
  createRitesSupport,
  RITES,
  type RitesContext,
  type RitesPending,
  type RitesState,
  type RitesSteal,
} from './rites-support';

export function ritesRules(source: RitesProgram) {
  const support = createRitesSupport(source);
  const { program } = support;
  const createActions = () => {
    const ask = defineAction<
      RitesState,
      { cardId: string; targetPlayerId: number }
    >({
      input: gameInput.object({
        cardId: gameInput.cardId(),
        targetPlayerId: gameInput.playerId(),
      }),
      documentation:
        'Demande une carte précise dans une famille déjà représentée.',
      available: ({ ctx }) => support.peaceTurns(ctx) === 0,
      validate: ({ actor, input, ctx }) =>
        support
          .enumerate(actor.id, ctx)
          .some(
            (request) =>
              request.cardId === input.cardId &&
              request.targetPlayerId === input.targetPlayerId,
          ),
      enumerate: ({ actor, ctx }) => support.enumerate(actor.id, ctx),
      execute: ({ actor, input, ctx }) => {
        const targetHand = ctx.cards.hand<string>(
          RITES.hands,
          input.targetPlayerId,
        );
        if (targetHand.includes(input.cardId)) {
          support.transfer(input.targetPlayerId, actor.id, input.cardId, ctx);
          support.completeFamilies(actor.id, ctx);
          support.determineVictory(ctx);
          return;
        }
        support.draw(actor.id, ctx);
        support.determineVictory(ctx);
        if (
          ctx.match.lifecycle() !== 'finished' &&
          ctx.choice.current() == null
        )
          ctx.turn.complete();
      },
    });
    const pass = defineAction<RitesState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Passe volontairement le tour.',
      execute: ({ actor, ctx }) => {
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.complete();
      },
    });
    return { ask, pass };
  };
  const { ask, pass } = createActions();

  const createChoices = () => ({
    'rites.card': defineChoice<RitesState, string>({
      input: gameInput.cardId(),
      resolve: ({ value, ctx }) => {
        const pending = ctx.choice.consumeContinuation<RitesPending>();
        if (!pending) rejectRule('Choix rituel introuvable');
        if (pending.kind === 'draw-one') {
          for (const cardId of pending.cardIds) {
            if (cardId === value)
              support.handleDrawn(pending.playerId, cardId, ctx);
            else ctx.cards.discard(RITES.deck, cardId);
          }
        } else if (pending.kind === 'resurrection') {
          ctx.cards.takeDiscard(RITES.deck, value);
          support.handleDrawn(pending.playerId, value, ctx);
        } else rejectRule('Type de choix de carte rituel invalide');
        support.finishChoice(ctx);
      },
    }),
    'rites.family': defineChoice<RitesState, string[]>({
      input: gameInput.array(gameInput.cardId(), { min: 1 }),
      resolve: ({ value, ctx }) => {
        const pending = ctx.choice.consumeContinuation<RitesPending>();
        if (!pending || pending.kind !== 'free-family')
          rejectRule('Choix de famille rituel invalide');
        for (const cardId of value)
          ctx.cards.take(RITES.hands, pending.playerId, cardId);
        const family = support.familyIds.find(
          (candidate) =>
            !ctx.cards
              .playerCompletedSets(RITES.families, pending.playerId)
              .includes(candidate),
        );
        if (family)
          ctx.cards.completeSet(RITES.families, pending.playerId, family, {
            allowIncomplete: true,
            consume: false,
          });
        support.finishChoice(ctx);
      },
    }),
    'rites.steal': defineChoice<RitesState, RitesSteal>({
      input: gameInput.object({
        targetPlayerId: gameInput.playerId(),
        cardId: gameInput.cardId(),
      }),
      resolve: ({ value, ctx }) => {
        const pending = ctx.choice.consumeContinuation<RitesPending>();
        if (!pending || pending.kind !== 'reveal-and-steal')
          rejectRule('Choix de vol rituel invalide');
        support.transfer(
          value.targetPlayerId,
          pending.playerId,
          value.cardId,
          ctx,
        );
        support.completeFamilies(pending.playerId, ctx);
        support.finishChoice(ctx);
      },
    }),
  });
  const choices = createChoices();

  const createEffects = () => ({
    'rites.draw-two': effect(({ playerId, ctx }) =>
      support.drawTwo(playerId, ctx),
    ),
    'rites.draw-one': effect(({ playerId, ctx }) =>
      support.draw(playerId, ctx),
    ),
    'rites.collect': effect(({ playerId, ctx }) => {
      for (const player of ctx.players.all()) {
        if (player.id === playerId) continue;
        const cardId = ctx.cards.hand<string>(RITES.hands, player.id)[0];
        if (cardId) support.transfer(player.id, playerId, cardId, ctx);
      }
      support.completeFamilies(playerId, ctx);
    }),
    'rites.resurrect': effect(({ playerId, ctx }) =>
      support.resurrection(playerId, ctx),
    ),
    'rites.free-family': effect(({ playerId, ctx }) =>
      support.freeFamily(playerId, ctx),
    ),
    'rites.dawn-cycle': defineEffect<RitesState, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ ctx }) => {
        for (const player of ctx.players.all()) {
          const cardId = ctx.cards.hand<string>(RITES.hands, player.id)[0];
          if (cardId)
            ctx.cards.play(RITES.hands, RITES.deck, player.id, cardId);
        }
        for (const player of ctx.players.all()) {
          support.draw(player.id, ctx);
          if (ctx.choice.current()) return;
          support.draw(player.id, ctx);
          if (ctx.choice.current()) return;
        }
      },
    }),
    'rites.steal-choice': effect(({ playerId, ctx }) =>
      support.steal(playerId, ctx),
    ),
  });
  const effects = createEffects();

  const familySets = cards.sets({
    id: RITES.families,
    hand: RITES.hands,
    deck: RITES.deck,
    visibility: 'public',
    sets: Object.fromEntries(
      support.familyIds.map((familyId) => [
        familyId,
        support.familyCards
          .filter((card) => card.familyId === familyId)
          .map((card) => card.id),
      ]),
    ),
  });
  const schema = defineCardsSchema({
    decks: {
      rites: cards.deck({
        id: RITES.deck,
        cards: program.cards.map((card) => card.id),
        shuffle: true,
        empty: 'recycle',
      }),
    },
    hands: {
      players: cards.hands({
        id: RITES.hands,
        deck: RITES.deck,
        initial: 5,
        initialDeferredCardIds: program.cards
          .filter((card) => card.type === 'special')
          .map((card) => card.id),
        visibility: 'owner',
      }),
    },
  });
  return {
    ask,
    pass,
    choices,
    effects,
    patterns: [
      cardGame({
        schema,
        deckId: RITES.deck,
        handId: RITES.hands,
      }),
    ],
    components: [
      familySets,
      inventory.set({ id: RITES.specials, visibility: 'public' }),
    ],
    lifecycle: {
      beforeTurn: ({
        ctx,
        player,
      }: {
        ctx: RitesContext;
        player: { id: number } | null;
      }) => {
        if (player) ctx.status.remove(player.id, RITES.silence);
      },
    },
    chooseBot(actorId: number, ctx: RitesContext) {
      const request =
        support.peaceTurns(ctx) === 0
          ? support.enumerate(actorId, ctx)[0]
          : null;
      return request
        ? { recipe: 'rites-ask-card' as const, payload: request }
        : { recipe: 'rites-pass' as const, payload: {} };
    },
  };
}

function effect(
  apply: (input: { playerId: number; ctx: RitesContext }) => void,
) {
  return defineEffect<RitesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) apply({ playerId, ctx });
    },
  });
}
