import {
  rejectRule,
  defineAction,
  defineEffect,
  drawCardsAtTurnStart,
  gameEffects,
  gameInput,
} from '../../../engine/sdk/public-api';
import {
  BANDE_A_BANANE_CARD_BY_ID,
  type BandeABananeCardDefinition,
  type BandeABananeMonkeySpecies,
} from './content';
import type { BandeABananeState } from './types';
import type { PlayerMap } from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

const DECK = 'banana';
const HANDS = 'players';
const HAND_LIMIT = 7;
const TROOPS = 'banana-troops';
export const BANANA_SPECIES = [
  'capucin',
  'mandrill',
  'gibbon',
  'babouin',
  'macaque',
] as const;

type PlayCardInput = {
  cardId: string;
  targetPlayerId?: number;
  species?: BandeABananeMonkeySpecies;
};

export const playCard = defineAction<BandeABananeState, PlayCardInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
    species: gameInput.optional(gameInput.enum(BANANA_SPECIES)),
  }),
  documentation: 'Joue une carte Singe, Joker, Action ou Piège de la main.',
  validate: ({ state, actor, input, ctx }) =>
    enumeratePlays(state, actor.id, ctx).some((candidate) =>
      samePlayInput(candidate, input),
    ),
  enumerate: ({ state, actor, ctx }) => enumeratePlays(state, actor.id, ctx),
  execute: ({ state: _state, actor, input, ctx }) => {
    const card = BANDE_A_BANANE_CARD_BY_ID[input.cardId];
    ctx.cards.take(HANDS, actor.id, input.cardId);
    if (card.type === 'monkey' || card.type === 'joker') {
      const species = card.species ?? input.species;
      if (!species) rejectRule('Espèce de joker absente');
      ctx.inventory.add(TROOPS, actor.id, troopItemId(card.id, species));
      ctx.events.message('game.card.played', {
        playerId: actor.id,
        cardId: card.id,
      });
      if (speciesCount(actor.id, ctx) === BANANA_SPECIES.length) {
        ctx.match.finish({ winners: [actor.id], reason: 'five-species' });
        ctx.events.message('bande-a-banane.victory-declared', {
          playerId: actor.id,
        });
        return;
      }
    } else {
      ctx.cards.discard(DECK, card.id);
      ctx.events.message('game.card.played', {
        playerId: actor.id,
        cardId: card.id,
      });
      ctx.effects.schedule(...effectsForPlay(card, input));
    }
    enforceHandLimit(actor.id, ctx);
    if (card.type === 'monkey' || card.type === 'joker') {
      ctx.turn.complete();
    } else {
      ctx.effects.schedule(gameEffects.completeTurn());
    }
  },
});

export const pass = defineAction<BandeABananeState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Termine le tour sans jouer de carte.',
  execute: ({ state: _state, actor, ctx }) => {
    ctx.events.message('game.player.passed', { playerId: actor.id });
    ctx.turn.complete();
  },
});

export const BANDE_A_BANANE_ACTIONS = { play_card: playCard, pass };

export function enumeratePlays(
  _state: BandeABananeState,
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): PlayCardInput[] {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  const opponents = ctx.players
    .all()
    .filter(
      (player) =>
        player.id !== playerId && ctx.cards.hand(HANDS, player.id).length > 0,
    );
  const missing = BANANA_SPECIES.filter(
    (species) =>
      !troops(playerId, ctx).some((entry) => entry.species === species),
  );
  return hand.flatMap((cardId) => {
    const card = BANDE_A_BANANE_CARD_BY_ID[cardId];
    if (!card) return [];
    if (card.type === 'monkey') {
      return card.species && missing.includes(card.species) ? [{ cardId }] : [];
    }
    if (card.type === 'joker') {
      return missing.map((species) => ({ cardId, species }));
    }
    if (card.action === 'vol-de-banane') {
      return opponents.map((target) => ({
        cardId,
        targetPlayerId: target.id,
      }));
    }
    if (card.action === 'cris-de-la-jungle') {
      return hand.length > 1
        ? opponents.map((target) => ({
            cardId,
            targetPlayerId: target.id,
          }))
        : [];
    }
    return [{ cardId }];
  });
}

function samePlayInput(left: PlayCardInput, right: PlayCardInput): boolean {
  return (
    left.cardId === right.cardId &&
    left.targetPlayerId === right.targetPlayerId &&
    left.species === right.species
  );
}

export const drawAtTurnStart = drawCardsAtTurnStart<BandeABananeState, string>({
  deckId: DECK,
  handId: HANDS,
  afterAttempt: ({ player, ctx }) => {
    if (!player) return;
    ctx.events.message('game.card.drawn', {
      playerId: player.id,
      deckId: DECK,
    });
  },
});

function effectsForPlay(
  card: BandeABananeCardDefinition,
  input: PlayCardInput,
): readonly GameEffectInstruction[] {
  return card.effects.map((effect) => {
    if (effect.kind === 'steal-card' && input.targetPlayerId != null) {
      return {
        ...effect,
        from: gameEffects.target.player(input.targetPlayerId),
      };
    }
    if (
      effect.kind === 'custom' &&
      effect.effectId === 'banana.exchange-random' &&
      input.targetPlayerId != null
    ) {
      return {
        ...effect,
        target: gameEffects.target.player(input.targetPlayerId),
      };
    }
    return effect;
  });
}

function exchangeRandom(
  playerId: number,
  targetId: number,
  cardToGive: string,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const received = ctx.cards.stealRandom<string>(HANDS, targetId, playerId);
  if (received == null) return;
  ctx.cards.transfer(HANDS, playerId, targetId, cardToGive);
}

function enforceHandLimit(
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const hand = ctx.cards.hand<string>(HANDS, playerId);
  while (hand.length > HAND_LIMIT) discardRandom(playerId, ctx);
}

function discardRandom(
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  ctx.cards.discardRandom(HANDS, DECK, playerId);
}

function speciesCount(
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): number {
  return new Set(troops(playerId, ctx).map((entry) => entry.species)).size;
}

export function bananaTroops(
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): PlayerMap<import('./types').BandeABananeTroopEntry[]> {
  return ctx.players.byId((player) => troops(player.id, ctx));
}

function troops(
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): import('./types').BandeABananeTroopEntry[] {
  return ctx.inventory.items(TROOPS, playerId).flatMap((itemId) => {
    const separator = itemId.lastIndexOf(':');
    const cardId = itemId.slice(0, separator);
    const species = itemId.slice(separator + 1);
    const card = BANDE_A_BANANE_CARD_BY_ID[cardId];
    return separator < 0 || !card || !isBananaSpecies(species)
      ? []
      : [{ cardId, species, isJoker: card.type === 'joker' }];
  });
}

function isBananaSpecies(value: string): value is BandeABananeMonkeySpecies {
  return BANANA_SPECIES.some((species) => species === value);
}

function troopItemId(
  cardId: string,
  species: BandeABananeMonkeySpecies,
): string {
  return `${cardId}:${species}`;
}

export const BANDE_A_BANANE_EFFECTS = {
  'banana.exchange-random': defineEffect<
    BandeABananeState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId == null || targetId == null) return;
      const cardIds = ctx.cards.hand<string>(HANDS, actorPlayerId);
      ctx.effects.schedule(
        gameEffects.chooseCard({
          handId: HANDS,
          cardIds,
          owner: gameEffects.target.player(actorPlayerId),
          chooser: gameEffects.target.player(actorPlayerId),
          choiceId: 'banana.exchange-card',
          effects: Object.fromEntries(
            cardIds.map((cardToGiveId) => [
              cardToGiveId,
              [
                gameEffects.custom(
                  'banana.finish-exchange',
                  { cardToGiveId },
                  gameEffects.target.player(targetId),
                ),
              ],
            ]),
          ),
        }),
      );
    },
  }),
  'banana.finish-exchange': defineEffect<
    BandeABananeState,
    { cardToGiveId: string }
  >({
    input: gameInput.object({ cardToGiveId: gameInput.cardId() }),
    apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null && targetId != null) {
        exchangeRandom(actorPlayerId, targetId, data.cardToGiveId, ctx);
      }
    },
  }),
} as const;
