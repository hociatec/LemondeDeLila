import { defineAction, gameInput } from '../../../core/application/public-api';
import {
  BANDE_A_BANANE_CARD_BY_ID,
  type BandeABananeCardDefinition,
  type BandeABananeMonkeySpecies,
} from './content';
import type { BandeABananeState } from './state';

const DECK = 'banana';
const HANDS = 'players';
const HAND_LIMIT = 7;
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
  cardToGiveId?: string;
  species?: BandeABananeMonkeySpecies;
};

export const playCard = defineAction<BandeABananeState, PlayCardInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
    cardToGiveId: gameInput.optional(gameInput.cardId()),
    species: gameInput.optional(gameInput.enum(BANANA_SPECIES)),
  }),
  documentation: 'Joue une carte Singe, Joker, Action ou Piège de la main.',
  availableInputs: ({ state, actor, ctx }) =>
    enumeratePlays(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    const card = BANDE_A_BANANE_CARD_BY_ID[input.cardId];
    ctx.cards.take(HANDS, actor.id, input.cardId);
    if (card.type === 'monkey' || card.type === 'joker') {
      const species = card.species ?? input.species;
      if (!species) throw new Error('Espèce de joker absente');
      state.troops[actor.id].push({
        cardId: card.id,
        species,
        isJoker: card.type === 'joker',
      });
      ctx.history.add(`${actor.username} accueille ${card.name}.`);
      if (speciesCount(state, actor.id) === BANANA_SPECIES.length) {
        state.winnerId = actor.id;
        ctx.history.add(`${actor.username} crie « BANAAAANE ! ».`);
        return;
      }
    } else {
      ctx.cards.discard(DECK, card.id);
      resolveEffect(state, actor.id, card, input, ctx);
    }
    enforceHandLimit(actor.id, ctx);
    endTurn(state, ctx);
  },
});

export const pass = defineAction<BandeABananeState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Termine le tour sans jouer de carte.',
  execute: ({ state, actor, ctx }) => {
    ctx.history.add(`${actor.username} passe son tour.`);
    endTurn(state, ctx);
  },
});

export const BANDE_A_BANANE_ACTIONS = { play_card: playCard, pass };

export function enumeratePlays(
  state: BandeABananeState,
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
      !state.troops[playerId].some((entry) => entry.species === species),
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
      return opponents.flatMap((target) =>
        hand
          .filter((cardToGiveId) => cardToGiveId !== cardId)
          .map((cardToGiveId) => ({
            cardId,
            targetPlayerId: target.id,
            cardToGiveId,
          })),
      );
    }
    return [{ cardId }];
  });
}

export function drawAtTurnStart(
  state: BandeABananeState,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const current = ctx.players.current();
  if (!current) return;
  drawTo(current.id, ctx);
  state.drawnPlayerId = current.id;
  ctx.history.add(`${current.username} pioche une carte.`);
}

export function skipPenalizedPlayer(
  state: BandeABananeState,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  state.drawnPlayerId = null;
  ctx.history.add(`${current.username} perd son tour.`);
  ctx.turn.end();
}

function resolveEffect(
  state: BandeABananeState,
  playerId: number,
  card: BandeABananeCardDefinition,
  input: PlayCardInput,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  if (card.action === 'vol-de-banane' && input.targetPlayerId != null) {
    stealRandom(input.targetPlayerId, playerId, ctx);
  } else if (
    card.action === 'cris-de-la-jungle' &&
    input.targetPlayerId != null &&
    input.cardToGiveId
  ) {
    exchangeRandom(playerId, input.targetPlayerId, input.cardToGiveId, ctx);
  } else if (card.action === 'grimpeur-fou') {
    drawTo(playerId, ctx);
    drawTo(playerId, ctx);
  } else if (card.trap === 'piege-a-noix-de-coco') {
    state.skipTurns[playerId] += 1;
  } else if (card.trap === 'tigre-rodeur') {
    discardRandom(playerId, ctx);
  }
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} joue ${card.name}.`,
  );
}

function stealRandom(
  sourceId: number,
  destinationId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const source = ctx.cards.hand<string>(HANDS, sourceId);
  const card = ctx.random.pick(source);
  if (!card) return;
  ctx.cards.take(HANDS, sourceId, card);
  ctx.cards.give(HANDS, destinationId, card);
}

function exchangeRandom(
  playerId: number,
  targetId: number,
  cardToGive: string,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const received = ctx.random.pick(ctx.cards.hand<string>(HANDS, targetId));
  ctx.cards.take(HANDS, playerId, cardToGive);
  ctx.cards.give(HANDS, targetId, cardToGive);
  if (!received) return;
  ctx.cards.take(HANDS, targetId, received);
  ctx.cards.give(HANDS, playerId, received);
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
  const card = ctx.random.pick(ctx.cards.hand<string>(HANDS, playerId));
  if (!card) return;
  ctx.cards.play(HANDS, DECK, playerId, card);
}

function drawTo(
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const card = ctx.cards.drawOrRecycle<string>(DECK);
  if (card) ctx.cards.give(HANDS, playerId, card);
}

function speciesCount(state: BandeABananeState, playerId: number): number {
  return new Set(state.troops[playerId].map((entry) => entry.species)).size;
}

function endTurn(
  state: BandeABananeState,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  state.drawnPlayerId = null;
  ctx.turn.end();
}
