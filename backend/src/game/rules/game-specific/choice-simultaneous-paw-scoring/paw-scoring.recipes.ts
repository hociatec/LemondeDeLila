import {
  gameInput,
  cards,
  defineCardsSchema,
  defineConfiguration,
  defineEffect,
  movement,
  setupPlayingPhases,
  publicField,
  cardGame,
  roundScoring,
  completeRound,
  drawForPlayer,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { includesInput } from './paw-scoring-input';
import {
  defineAction,
  defineEmptyAction,
} from '../../../engine/sdk/extension-api';
import type {
  PawScoringParade,
  PawScoringPower,
  PawScoringProgram,
} from './program';
import {
  resetPawScoringRound,
  scorePawScoringRound,
} from './paw-scoring-rounds';
import { rejectRule } from '../../../engine/sdk/extension-api';
import { createPawScoringCardRules } from './paw-scoring-card-rules';

type State = Record<string, never>;
type Context = GameContext<State>;
type CardInput = { cardId: string; targetPlayerId?: number };

export function pawScoringRules(source: PawScoringProgram) {
  const program = structuredClone(source);
  const phases = setupPlayingPhases<State>();
  const {
    cardById,
    playable,
    effectsForPlay,
    mustCounter,
    applyParade,
    applyPower,
  } = createPawScoringCardRules(program);
  const cardSchema = defineCardsSchema({
    decks: {
      [program.deckId]: cards.deck({
        id: program.deckId,
        cards: program.cards.map((card) => card.id),
        shuffle: true,
        empty: 'recycle',
      }),
    },
    hands: {
      [program.handId]: cards.hands({
        id: program.handId,
        deck: program.deckId,
        initial: program.initialHandSize,
        visibility: 'owner',
      }),
    },
  });

  const createActions = () => {
    const draw = defineEmptyAction<State>({
      documentation: 'Pioche une carte au début du tour, une seule fois.',
      available: ({ actor, ctx }) => ctx.effects.sourcePlayerId() !== actor.id,
      execute: ({ actor, ctx }) => {
        if (ctx.effects.sourcePlayerId() === actor.id)
          rejectRule('Pioche déjà faite');
        const cardId = drawForPlayer<State, string>(ctx, {
          deckId: program.deckId,
          handId: program.handId,
          playerId: actor.id,
          recycle: true,
        })[0];
        if (cardId) {
          ctx.events.message('game.card.drawn', {
            playerId: actor.id,
            deckId: program.deckId,
            cardId,
          });
          return;
        }
        if (ctx.cards.hand<string>(program.handId, actor.id).length === 0) {
          ctx.effects.clearSource();
          ctx.events.message('game.player.passed', {
            playerId: actor.id,
            reason: 'no-card',
          });
          ctx.turn.end();
        }
      },
    });
    const play = defineAction<State, CardInput>({
      input: gameInput.object({
        cardId: gameInput.cardId(),
        targetPlayerId: gameInput.optional(gameInput.playerId()),
      }),
      documentation:
        'Joue une carte de déplacement, obstacle, contre ou pouvoir autorisée.',
      available: ({ actor, ctx }) => playable(actor.id, ctx).length > 0,
      validate: ({ actor, input, ctx }) =>
        includesInput(playable(actor.id, ctx), input),
      enumerate: ({ actor, ctx }) => playable(actor.id, ctx),
      execute: ({ actor, input, ctx }) => {
        if (ctx.effects.sourcePlayerId() !== actor.id)
          rejectRule('Vous devez piocher avant de jouer');
        if (!includesInput(playable(actor.id, ctx), input))
          rejectRule('Carte paw-scoring card indisponible');
        const card = cardById.get(input.cardId);
        if (!card) rejectRule('Carte paw-scoring card inconnue');
        ctx.cards.play(program.handId, program.deckId, actor.id, input.cardId);
        ctx.events.message('game.card.played', {
          playerId: actor.id,
          cardId: card.id,
        });
        ctx.effects.schedule(
          ...effectsForPlay(card, input.targetPlayerId ?? null),
        );
        ctx.effects.clearSource();
      },
    });
    const discard = defineAction<State, { cardId?: string }>({
      input: gameInput.object({
        cardId: gameInput.optional(gameInput.cardId()),
      }),
      documentation: 'Défausse une carte jouable ou passe avec une main vide.',
      available: ({ actor, ctx }) =>
        ctx.effects.sourcePlayerId() === actor.id &&
        !mustCounter(actor.id, ctx),
      validate: ({ actor, input, ctx }) => {
        if (
          ctx.effects.sourcePlayerId() !== actor.id ||
          mustCounter(actor.id, ctx)
        )
          return false;
        const hand = ctx.cards.hand<string>(program.handId, actor.id);
        return hand.length === 0
          ? input.cardId == null
          : hand.includes(input.cardId ?? '');
      },
      enumerate: ({ actor, ctx }) => {
        if (
          ctx.effects.sourcePlayerId() !== actor.id ||
          mustCounter(actor.id, ctx)
        )
          return [];
        const hand = ctx.cards.hand<string>(program.handId, actor.id);
        return hand.length === 0 ? [{}] : hand.map((cardId) => ({ cardId }));
      },
      execute: ({ actor, input, ctx }) => {
        if (
          ctx.effects.sourcePlayerId() !== actor.id ||
          mustCounter(actor.id, ctx)
        )
          rejectRule('Défausse paw-scoring card interdite');
        const hand = ctx.cards.hand<string>(program.handId, actor.id);
        const cardId = input.cardId ?? hand[0];
        if (cardId)
          ctx.cards.play(program.handId, program.deckId, actor.id, cardId);
        ctx.effects.clearSource();
        ctx.turn.end();
      },
    });
    return { draw, play, discard };
  };
  const { draw, play, discard } = createActions();

  const chooseBot = (actorId: number, ctx: Context) => {
    if (ctx.effects.sourcePlayerId() !== actorId)
      return { recipe: 'paw-round-draw' as const, payload: {} };
    const input = playable(actorId, ctx)[0];
    if (input)
      return {
        recipe: 'paw-round-play' as const,
        payload: { ...input },
      };
    const cardId = ctx.cards.hand<string>(program.handId, actorId)[0];
    return {
      recipe: 'paw-round-discard' as const,
      payload: cardId ? { cardId } : {},
    };
  };
  const buildRules = () => {
    const scoring = roundScoring<State>({
      score: ({ ctx }) => scorePawScoringRound(program, ctx),
    });
    const effects = {
      'paw-round.move': defineEffect<State, { value: number }>({
        input: gameInput.object({
          value: gameInput.number({ integer: true, min: 1 }),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId == null) return;
          const position = ctx.movement.move(
            program.trackId,
            actorPlayerId,
            data.value,
          );
          for (const limit of program.mechanics.moveLimits)
            if (data.value === limit.value)
              ctx.resources.add(
                actorPlayerId,
                program.statusPrefix + limit.resource,
                1,
              );
          if (position === program.goal) {
            completeRound(ctx, {
              winnerPlayerIds: [actorPlayerId],
              next: { starterPlayerId: actorPlayerId },
            });
          } else ctx.turn.end();
        },
      }),
      'paw-round.parade': defineEffect<State, { parade: PawScoringParade }>({
        input: gameInput.object({
          parade: gameInput.enum(program.mechanics.counters),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            applyParade(actorPlayerId, data.parade, ctx);
        },
      }),
      'paw-round.power': defineEffect<State, { power: PawScoringPower }>({
        input: gameInput.object({
          power: gameInput.enum(
            program.mechanics.powers.map((power) => power.id),
          ),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null) applyPower(actorPlayerId, data.power, ctx);
        },
      }),
    };
    return {
      draw,
      play,
      discard,
      effects,
      patterns: [
        cardGame({
          schema: cardSchema,
          deckId: program.deckId,
          handId: program.handId,
        }),
      ],
      components: [
        movement.track({ id: program.trackId, spaces: program.goal + 1 }),
      ],
      config: defineConfiguration<State, { roundsToPlay: number }>({
        input: gameInput.object({
          roundsToPlay: gameInput.number({ integer: true, min: 1, max: 20 }),
        }),
        defaults: { roundsToPlay: program.defaultRounds },
        phase: phases.initialPhase,
        permission: 'owner',
        ui: {
          title: 'Nombre de manches',
          submitLabel: 'Démarrer la course',
        },
        onConfigured: ({ ctx }) => {
          phases.transition(ctx, 'playing');
          const firstPlayerId = ctx.players.all()[0]?.id;
          if (firstPlayerId != null) {
            ctx.round.start(firstPlayerId);
            ctx.turn.to(firstPlayerId);
          }
        },
      }),
      lifecycle: {
        ...scoring.lifecycle,
        onRoundStart: ({ ctx }: { state: State; ctx: Context }) =>
          resetPawScoringRound(program, ctx),
      },
      playerValuesVisibility: { statuses: publicField() },
      chooseBot,
    };
  };
  return buildRules();
}
