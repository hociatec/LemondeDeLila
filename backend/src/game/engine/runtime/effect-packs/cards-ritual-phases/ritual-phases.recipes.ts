import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-contracts';
import { defineCardsSchema } from '../../cards/typed-cards';
import type { RitualPhasesProgram } from './program';
import { defineEffect } from '../../effects/effects-core';
import { inventory } from '../../kits/inventory-kit';
import { cardGame } from '../../patterns/gameplay-pattern-track-card';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import {
  createRitualPhasesSupport,
  RITUAL_PHASES,
  type RitualPhasesContext,
  type RitualPhasesPending,
  type RitualPhasesState,
  type RitualPhasesSteal,
} from './ritual-phases-support';

export function ritualPhasesRules(source: RitualPhasesProgram) {
  const support = createRitualPhasesSupport(source);
  const { program } = support;
  const createActions = () => {
    const ask = defineAction<
      RitualPhasesState,
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
          RITUAL_PHASES.hands,
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
    const pass = defineAction<RitualPhasesState, Record<string, never>>({
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
    'cards-ritual-phases.card': defineChoice<RitualPhasesState, string>({
      input: gameInput.cardId(),
      resolve: ({ value, ctx }) => {
        const pending = ctx.choice.consumeContinuation<RitualPhasesPending>();
        if (!pending) rejectRule('Choix rituel introuvable');
        if (pending.kind === 'draw-one') {
          for (const cardId of pending.cardIds) {
            if (cardId === value)
              support.handleDrawn(pending.playerId, cardId, ctx);
            else ctx.cards.discard(RITUAL_PHASES.deck, cardId);
          }
        } else if (pending.kind === 'resurrection') {
          ctx.cards.takeDiscard(RITUAL_PHASES.deck, value);
          support.handleDrawn(pending.playerId, value, ctx);
        } else rejectRule('Type de choix de carte rituel invalide');
        support.finishChoice(ctx);
      },
    }),
    'cards-ritual-phases.family': defineChoice<RitualPhasesState, string[]>({
      input: gameInput.array(gameInput.cardId(), { min: 1 }),
      resolve: ({ value, ctx }) => {
        const pending = ctx.choice.consumeContinuation<RitualPhasesPending>();
        if (!pending || pending.kind !== 'free-family')
          rejectRule('Choix de famille rituel invalide');
        for (const cardId of value)
          ctx.cards.take(RITUAL_PHASES.hands, pending.playerId, cardId);
        const family = support.familyIds.find(
          (candidate) =>
            !ctx.cards
              .playerCompletedSets(RITUAL_PHASES.families, pending.playerId)
              .includes(candidate),
        );
        if (family)
          ctx.cards.completeSet(
            RITUAL_PHASES.families,
            pending.playerId,
            family,
            {
              allowIncomplete: true,
              consume: false,
            },
          );
        support.finishChoice(ctx);
      },
    }),
    'cards-ritual-phases.steal': defineChoice<
      RitualPhasesState,
      RitualPhasesSteal
    >({
      input: gameInput.object({
        targetPlayerId: gameInput.playerId(),
        cardId: gameInput.cardId(),
      }),
      resolve: ({ value, ctx }) => {
        const pending = ctx.choice.consumeContinuation<RitualPhasesPending>();
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
    'cards-ritual-phases.draw-two': effect(({ playerId, ctx }) =>
      support.drawTwo(playerId, ctx),
    ),
    'cards-ritual-phases.draw-one': effect(({ playerId, ctx }) =>
      support.draw(playerId, ctx),
    ),
    'cards-ritual-phases.collect': effect(({ playerId, ctx }) => {
      for (const player of ctx.players.all()) {
        if (player.id === playerId) continue;
        const cardId = ctx.cards.hand<string>(
          RITUAL_PHASES.hands,
          player.id,
        )[0];
        if (cardId) support.transfer(player.id, playerId, cardId, ctx);
      }
      support.completeFamilies(playerId, ctx);
    }),
    'cards-ritual-phases.resurrect': effect(({ playerId, ctx }) =>
      support.resurrection(playerId, ctx),
    ),
    'cards-ritual-phases.free-family': effect(({ playerId, ctx }) =>
      support.freeFamily(playerId, ctx),
    ),
    'cards-ritual-phases.dawn-cycle': defineEffect<
      RitualPhasesState,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ ctx }) => {
        for (const player of ctx.players.all()) {
          const cardId = ctx.cards.hand<string>(
            RITUAL_PHASES.hands,
            player.id,
          )[0];
          if (cardId)
            ctx.cards.play(
              RITUAL_PHASES.hands,
              RITUAL_PHASES.deck,
              player.id,
              cardId,
            );
        }
        for (const player of ctx.players.all()) {
          support.draw(player.id, ctx);
          if (ctx.choice.current()) return;
          support.draw(player.id, ctx);
          if (ctx.choice.current()) return;
        }
      },
    }),
    'cards-ritual-phases.steal-choice': effect(({ playerId, ctx }) =>
      support.steal(playerId, ctx),
    ),
  });
  const effects = createEffects();

  const familySets = cards.sets({
    id: RITUAL_PHASES.families,
    hand: RITUAL_PHASES.hands,
    deck: RITUAL_PHASES.deck,
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
      ritualPhases: cards.deck({
        id: RITUAL_PHASES.deck,
        cards: program.cards.map((card) => card.id),
        shuffle: true,
        empty: 'recycle',
      }),
    },
    hands: {
      players: cards.hands({
        id: RITUAL_PHASES.hands,
        deck: RITUAL_PHASES.deck,
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
        deckId: RITUAL_PHASES.deck,
        handId: RITUAL_PHASES.hands,
      }),
    ],
    components: [
      familySets,
      inventory.set({ id: RITUAL_PHASES.specials, visibility: 'public' }),
    ],
    lifecycle: {
      beforeTurn: ({
        ctx,
        player,
      }: {
        ctx: RitualPhasesContext;
        player: { id: number } | null;
      }) => {
        if (player) ctx.status.remove(player.id, RITUAL_PHASES.silence);
      },
    },
    chooseBot(actorId: number, ctx: RitualPhasesContext) {
      const request =
        support.peaceTurns(ctx) === 0
          ? support.enumerate(actorId, ctx)[0]
          : null;
      return request
        ? { recipe: 'cards-ritual-phases-ask-card' as const, payload: request }
        : { recipe: 'cards-ritual-phases-pass' as const, payload: {} };
    },
  };
}
function effect(
  apply: (input: { playerId: number; ctx: RitualPhasesContext }) => void,
) {
  return defineEffect<RitualPhasesState, Record<string, never>>({
    input: gameInput.object({}),
    apply: ({ targetPlayerIds, ctx }) => {
      const playerId = targetPlayerIds[0];
      if (playerId != null) apply({ playerId, ctx });
    },
  });
}
