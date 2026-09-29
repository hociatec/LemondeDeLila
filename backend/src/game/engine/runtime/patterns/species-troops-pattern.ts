import { defineAction, defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineEffect,
  defineEmptyEffect,
  gameEffects,
} from './pattern-capabilities';
import { drawCardsAtTurnStart } from './gameplay-pattern-track-card';
import { definePattern } from './gameplay-pattern-core';

type State = Record<string, never>;
type Context = GameContext<State>;
type Play = { cardId: string; targetPlayerId?: number; species?: string };
type Card = {
  id: string;
  name: string;
  description?: string;
  type: 'monkey' | 'action' | 'trap' | 'joker';
  species?: string;
  action?: string;
  trap?: string;
  effects: readonly GameEffectInstruction[];
};
export type SpeciesTroopsOptions = {
  playRecipe: string;
  passRecipe: string;
  playAction: string;
  passAction: string;
  deckId: string;
  handId: string;
  inventoryId: string;
  exchangeChoiceId: string;
  handLimit: number;
  victoryReason: string;
  species: readonly string[];
  cards: readonly Card[];
};

export function speciesTroops(source: SpeciesTroopsOptions) {
  const program = structuredClone(source);
  const byId = new Map(program.cards.map((card) => [card.id, card]));
  const enumerate = (playerId: number, ctx: Context) =>
    enumeratePlays(program, byId, playerId, ctx);
  return definePattern({
    id: `species-troops:${program.deckId}`,
    mechanics: ['cards', 'collection', 'effects', 'choices'],
    actions: {
      [program.playRecipe]: defineAction<State, Play>({
        input: gameInput.object({
          cardId: gameInput.cardId(),
          targetPlayerId: gameInput.optional(gameInput.playerId()),
          species: gameInput.optional(gameInput.enum(program.species)),
        }),
        validate: ({ actor, input, ctx }) =>
          enumerate(actor.id, ctx).some((candidate) =>
            samePlay(candidate, input),
          ),
        enumerate: ({ actor, ctx }) => enumerate(actor.id, ctx),
        execute: ({ actor, input, ctx }) =>
          play(program, byId, actor.id, input, ctx),
        documentation: 'Joue une carte de collection, action ou piège.',
      }),
      [program.passRecipe]: defineEmptyAction<State>({
        execute: ({ actor, ctx }) => {
          ctx.events.message('game.player.passed', { playerId: actor.id });
          ctx.turn.complete();
        },
        documentation: 'Termine le tour sans jouer de carte.',
      }),
    },
    effects: buildEffects(program),
    lifecycle: {
      beforeTurn: drawCardsAtTurnStart<State, string>({
        deckId: program.deckId,
        handId: program.handId,
        afterAttempt: ({ player, ctx }) => {
          if (player)
            ctx.events.message('game.card.drawn', {
              playerId: player.id,
              deckId: program.deckId,
            });
        },
      }),
    },
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const payload = enumerate(actor.id, ctx)[0];
        const action = payload ? program.playAction : program.passAction;
        return availableActions.includes(action)
          ? { type: action, payload: payload ?? {} }
          : null;
      },
    },
  });
}

function enumeratePlays(
  program: SpeciesTroopsOptions,
  byId: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
): Play[] {
  const hand = ctx.cards.hand<string>(program.handId, playerId);
  const opponents = ctx.players
    .all()
    .filter(
      (player) =>
        player.id !== playerId &&
        ctx.cards.hand(program.handId, player.id).length > 0,
    );
  const missing = program.species.filter(
    (species) => !troops(program, byId, playerId, ctx).includes(species),
  );
  return hand.flatMap((cardId) => {
    const card = byId.get(cardId);
    if (!card) return [];
    if (card.type === 'monkey')
      return card.species && missing.includes(card.species) ? [{ cardId }] : [];
    if (card.type === 'joker')
      return missing.map((species) => ({ cardId, species }));
    if (
      card.effects.some(
        (effect) =>
          effect.kind === 'custom' &&
          effect.effectId === 'species.exchange-random',
      )
    )
      return hand.length > 1
        ? opponents.map((target) => ({ cardId, targetPlayerId: target.id }))
        : [];
    if (card.effects.some((effect) => effect.kind === 'steal-card'))
      return opponents.map((target) => ({ cardId, targetPlayerId: target.id }));
    return [{ cardId }];
  });
}

function play(
  program: SpeciesTroopsOptions,
  byId: ReadonlyMap<string, Card>,
  playerId: number,
  input: Play,
  ctx: Context,
): void {
  const card = byId.get(input.cardId);
  if (!card)
    throw new GameRuleViolationError('COLLECTION_SPECIES_TROOPS_CARD_UNKNOWN');
  ctx.cards.take(program.handId, playerId, input.cardId);
  if (card.type === 'monkey' || card.type === 'joker') {
    const species = card.species ?? input.species;
    if (!species)
      throw new GameRuleViolationError(
        'COLLECTION_SPECIES_TROOPS_SPECIES_MISSING',
      );
    ctx.inventory.add(program.inventoryId, playerId, `${card.id}:${species}`);
    ctx.events.message('game.card.played', { playerId, cardId: card.id });
    if (
      new Set(troops(program, byId, playerId, ctx)).size ===
      program.species.length
    ) {
      ctx.match.finish({ winners: [playerId], reason: program.victoryReason });
      ctx.events.message('collection-species-troops.victory-declared', {
        playerId,
      });
      return;
    }
  } else {
    ctx.cards.discard(program.deckId, card.id);
    ctx.events.message('game.card.played', { playerId, cardId: card.id });
    ctx.effects.schedule(...effectsForPlay(card, input));
  }
  enforceHandLimit(program, playerId, ctx);
  if (card.type === 'monkey' || card.type === 'joker') ctx.turn.complete();
  else ctx.effects.schedule(gameEffects.completeTurn());
}

function effectsForPlay(
  card: Card,
  input: Play,
): readonly GameEffectInstruction[] {
  return card.effects.map((effect) => {
    if (effect.kind === 'steal-card' && input.targetPlayerId != null)
      return {
        ...effect,
        from: gameEffects.target.player(input.targetPlayerId),
      };
    if (
      effect.kind === 'custom' &&
      effect.effectId === 'species.exchange-random' &&
      input.targetPlayerId != null
    )
      return {
        ...effect,
        target: gameEffects.target.player(input.targetPlayerId),
      };
    return effect;
  });
}

function buildEffects(program: SpeciesTroopsOptions) {
  return {
    'species.exchange-random': defineEmptyEffect<State>(
      ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId == null || targetId == null) return;
        const cardIds = ctx.cards.hand<string>(program.handId, actorPlayerId);
        ctx.effects.schedule(
          gameEffects.chooseCard({
            handId: program.handId,
            cardIds,
            owner: gameEffects.target.player(actorPlayerId),
            chooser: gameEffects.target.player(actorPlayerId),
            choiceId: program.exchangeChoiceId,
            effects: Object.fromEntries(
              cardIds.map((cardToGiveId) => [
                cardToGiveId,
                [
                  gameEffects.custom(
                    'species.finish-exchange',
                    { cardToGiveId },
                    gameEffects.target.player(targetId),
                  ),
                ],
              ]),
            ),
          }),
        );
      },
    ),
    'species.finish-exchange': defineEffect<State, { cardToGiveId: string }>({
      input: gameInput.object({ cardToGiveId: gameInput.cardId() }),
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId == null || targetId == null) return;
        const received = ctx.cards.stealRandom<string>(
          program.handId,
          targetId,
          actorPlayerId,
        );
        if (received != null)
          ctx.cards.transfer(
            program.handId,
            actorPlayerId,
            targetId,
            data.cardToGiveId,
          );
      },
    }),
  };
}

function enforceHandLimit(
  program: SpeciesTroopsOptions,
  playerId: number,
  ctx: Context,
): void {
  const excess =
    ctx.cards.hand<string>(program.handId, playerId).length - program.handLimit;
  for (let index = 0; index < excess; index++)
    ctx.cards.discardRandom(program.handId, program.deckId, playerId);
}
function troops(
  program: SpeciesTroopsOptions,
  byId: ReadonlyMap<string, Card>,
  playerId: number,
  ctx: Context,
): string[] {
  return ctx.inventory
    .items(program.inventoryId, playerId)
    .flatMap((itemId) => {
      const separator = itemId.lastIndexOf(':');
      const card = byId.get(itemId.slice(0, separator));
      const species = itemId.slice(separator + 1);
      const matched = program.species.find(
        (candidate) => candidate === species,
      );
      return separator >= 0 && card && matched ? [matched] : [];
    });
}
function samePlay(left: Play, right: Play): boolean {
  return (
    left.cardId === right.cardId &&
    left.targetPlayerId === right.targetPlayerId &&
    left.species === right.species
  );
}
