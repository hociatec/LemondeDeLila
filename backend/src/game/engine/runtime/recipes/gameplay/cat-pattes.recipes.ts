import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-kit';
import { defineCardsSchema } from '../../cards/typed-cards';
import { defineConfiguration } from '../../configuration/configuration-kit';
import type {
  CatPattesCard,
  CatPattesObstacle,
  CatPattesParade,
  CatPattesPower,
  CatPattesProgram,
} from '../../contracts/cat-pattes-program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import { gameEffects } from '../../effects/effects-dsl';
import { movement } from '../../kits/movement-kit';
import { setupPlayingPhases } from '../../kits/phase-kit';
import { publicField } from '../../kits/visibility-kit';
import { cardGame } from '../../patterns/gameplay-pattern-track-card';
import { roundScoring } from '../../patterns/gameplay-pattern-round-economy';
import { completeRound } from './track-round.recipes';
import { drawForPlayer } from './card-dice.recipes';
import { resetCatPattesRound, scoreCatPattesRound } from './cat-pattes-rounds';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import {
  OBSTACLE_TO_PARADE,
  PARADE_DISABLED_BY_POWER,
} from './cat-pattes-rules';

type State = Record<string, never>;
type Context = GameContext<State>;
type CardInput = { cardId: string; targetPlayerId?: number };

export function catPattesRules(source: CatPattesProgram) {
  const program = structuredClone(source);
  const phases = setupPlayingPhases<State>();
  const cardById = new Map(program.cards.map((card) => [card.id, card]));
  const status = {
    obstacle: program.statusPrefix + 'obstacle',
    power: program.statusPrefix + 'power.',
    hasSun: program.statusPrefix + 'has-sun',
    sunNotReady: program.statusPrefix + 'sun-not-ready',
    obstacleLock: program.statusPrefix + 'obstacle-lock',
    turboPlayed: program.statusPrefix + 'turbo-played',
  };
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
    const draw = defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
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
        'Joue une carte Pattes, Obstacle, Parade ou Pouvoir autorisée.',
      available: ({ actor, ctx }) => playable(actor.id, ctx).length > 0,
      validate: ({ actor, input, ctx }) =>
        includesInput(playable(actor.id, ctx), input),
      enumerate: ({ actor, ctx }) => playable(actor.id, ctx),
      execute: ({ actor, input, ctx }) => {
        if (ctx.effects.sourcePlayerId() !== actor.id)
          rejectRule('Vous devez piocher avant de jouer');
        if (!includesInput(playable(actor.id, ctx), input))
          rejectRule('Carte Cat Pattes indisponible');
        const card = cardById.get(input.cardId);
        if (!card) rejectRule('Carte Cat Pattes inconnue');
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
          rejectRule('Défausse Cat Pattes interdite');
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

  function playable(actorId: number, ctx: Context): CardInput[] {
    if (ctx.effects.sourcePlayerId() !== actorId) return [];
    const blocked = isBlocked(actorId, ctx);
    return ctx.cards.hand<string>(program.handId, actorId).flatMap((cardId) => {
      const card = cardById.get(cardId);
      if (!card || (blocked && card.type !== 'parade' && card.type !== 'bot'))
        return [];
      if (card.type === 'pattes')
        return canPlayPattes(actorId, card.value, ctx) ? [{ cardId }] : [];
      if (card.type === 'obstacle')
        return ctx.players
          .all()
          .filter(
            (player) =>
              player.id !== actorId &&
              canReceiveObstacle(player.id, card.obstacle, ctx),
          )
          .map((player) => ({ cardId, targetPlayerId: player.id }));
      if (card.type === 'parade')
        return canPlayParade(actorId, card.parade, ctx) ? [{ cardId }] : [];
      return canPlayPower(actorId, card.bot, ctx) ? [{ cardId }] : [];
    });
  }
  function effectsForPlay(card: CatPattesCard, targetId: number | null) {
    if (card.type !== 'obstacle' || targetId == null) return card.effects;
    return card.effects.map((effect) =>
      effect.kind === 'add-status'
        ? { ...effect, target: gameEffects.target.player(targetId) }
        : effect,
    );
  }
  function canPlayPattes(playerId: number, value: number, ctx: Context) {
    return (
      (ctx.status.has(playerId, status.hasSun) ||
        hasPower(playerId, 'passage-star', ctx)) &&
      !isBlocked(playerId, ctx) &&
      value > 0 &&
      ctx.movement.position(program.trackId, playerId) + value <= program.goal
    );
  }
  function canReceiveObstacle(
    playerId: number,
    obstacle: CatPattesObstacle,
    ctx: Context,
  ) {
    if (powerIgnoresObstacle(powers(playerId, ctx), obstacle)) return false;
    if (
      ctx.status.has(playerId, status.obstacleLock) &&
      !hasPower(playerId, 'passage-star', ctx)
    )
      return false;
    return currentObstacle(playerId, ctx) == null;
  }
  function canPlayParade(
    playerId: number,
    parade: CatPattesParade,
    ctx: Context,
  ) {
    if (
      powers(playerId, ctx).some((power) =>
        PARADE_DISABLED_BY_POWER[power].includes(parade),
      )
    )
      return false;
    const obstacle = currentObstacle(playerId, ctx);
    return obstacle
      ? OBSTACLE_TO_PARADE[obstacle] === parade
      : parade === 'rayon' && !ctx.status.has(playerId, status.sunNotReady);
  }
  function canPlayPower(playerId: number, power: CatPattesPower, ctx: Context) {
    const obstacle = currentObstacle(playerId, ctx);
    return obstacle == null || powerIgnoresObstacle([power], obstacle);
  }
  function applyParade(
    playerId: number,
    parade: CatPattesParade,
    ctx: Context,
  ) {
    const obstacle = currentObstacle(playerId, ctx);
    const removes = obstacle != null && OBSTACLE_TO_PARADE[obstacle] === parade;
    if (removes) ctx.status.remove(playerId, status.obstacle);
    if (parade === 'rayon') {
      addRoundStatus(playerId, status.hasSun, ctx);
      addRoundStatus(playerId, status.sunNotReady, ctx);
      ctx.status.remove(playerId, status.obstacleLock);
    } else if (removes) {
      ctx.status.remove(playerId, status.sunNotReady);
      addRoundStatus(playerId, status.obstacleLock, ctx);
    }
  }
  function applyPower(playerId: number, power: CatPattesPower, ctx: Context) {
    addRoundStatus(playerId, status.power + power, ctx);
    const obstacle = currentObstacle(playerId, ctx);
    if (obstacle && powerIgnoresObstacle([power], obstacle)) {
      ctx.status.remove(playerId, status.obstacle);
      ctx.status.remove(playerId, status.sunNotReady);
      if (power !== 'passage-star')
        addRoundStatus(playerId, status.obstacleLock, ctx);
      else ctx.status.remove(playerId, status.obstacleLock);
    }
  }
  function mustCounter(playerId: number, ctx: Context) {
    return isBlocked(playerId, ctx) && playable(playerId, ctx).length > 0;
  }
  function isBlocked(playerId: number, ctx: Context) {
    const obstacle = currentObstacle(playerId, ctx);
    return (
      obstacle != null && !powerIgnoresObstacle(powers(playerId, ctx), obstacle)
    );
  }
  function hasPower(playerId: number, power: CatPattesPower, ctx: Context) {
    return ctx.status.has(playerId, status.power + power);
  }
  function powers(playerId: number, ctx: Context): CatPattesPower[] {
    return ctx.status
      .list(playerId)
      .filter((entry) => entry.id.startsWith(status.power))
      .map((entry) => entry.id.slice(status.power.length))
      .filter((power): power is CatPattesPower =>
        Object.hasOwn(PARADE_DISABLED_BY_POWER, power),
      );
  }
  function currentObstacle(
    playerId: number,
    ctx: Context,
  ): CatPattesObstacle | null {
    const value = ctx.status.get(playerId, status.obstacle)?.data.obstacle;
    return isObstacle(value) ? value : null;
  }
  function isObstacle(value: unknown): value is CatPattesObstacle {
    return (
      value === 'gamelle' ||
      value === 'pluie' ||
      value === 'chien' ||
      value === 'coussin' ||
      value === 'sol'
    );
  }
  function addRoundStatus(playerId: number, statusId: string, ctx: Context) {
    ctx.status.add(playerId, statusId, { scope: 'round' });
  }
  function powerIgnoresObstacle(
    activePowers: readonly CatPattesPower[],
    obstacle: CatPattesObstacle,
  ) {
    return activePowers.some(
      (power) =>
        (power === 'reserve' && obstacle === 'gamelle') ||
        (power === 'chat-ninja' && obstacle === 'chien') ||
        (power === 'patte-blindee' && obstacle === 'coussin') ||
        (power === 'passage-star' &&
          (obstacle === 'pluie' || obstacle === 'sol')),
    );
  }
  const buildRules = () => {
    const scoring = roundScoring<State>({
      score: ({ ctx }) => scoreCatPattesRound(program, ctx),
    });
    const effects = {
      'cat-pattes.move': defineEffect<State, { value: number }>({
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
          if (data.value === 150)
            ctx.resources.add(actorPlayerId, status.turboPlayed, 1);
          if (position === program.goal) {
            completeRound(ctx, {
              winnerPlayerIds: [actorPlayerId],
              next: { starterPlayerId: actorPlayerId },
            });
          } else ctx.turn.end();
        },
      }),
      'cat-pattes.parade': defineEffect<State, { parade: CatPattesParade }>({
        input: gameInput.object({
          parade: gameInput.enum([
            'croquettes',
            'rayon',
            'dodo',
            'coussin',
            'saut',
          ]),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            applyParade(actorPlayerId, data.parade, ctx);
        },
      }),
      'cat-pattes.power': defineEffect<State, { power: CatPattesPower }>({
        input: gameInput.object({
          power: gameInput.enum([
            'reserve',
            'chat-ninja',
            'patte-blindee',
            'passage-star',
          ]),
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
          resetCatPattesRound(program, status.turboPlayed, ctx),
      },
      playerValuesVisibility: { statuses: publicField() },
      chooseBot(actorId: number, ctx: Context) {
        if (ctx.effects.sourcePlayerId() !== actorId)
          return { recipe: 'cat-pattes-draw' as const, payload: {} };
        const input = playable(actorId, ctx)[0];
        if (input)
          return { recipe: 'cat-pattes-play' as const, payload: { ...input } };
        const cardId = ctx.cards.hand<string>(program.handId, actorId)[0];
        return {
          recipe: 'cat-pattes-discard' as const,
          payload: cardId ? { cardId } : {},
        };
      },
    };
  };
  return buildRules();
}

function includesInput(inputs: readonly CardInput[], input: CardInput) {
  return inputs.some(
    (candidate) =>
      candidate.cardId === input.cardId &&
      candidate.targetPlayerId === input.targetPlayerId,
  );
}
