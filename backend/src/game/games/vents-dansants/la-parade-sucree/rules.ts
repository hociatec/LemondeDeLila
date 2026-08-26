import {
  rejectRule,
  defineAction,
  gameInput,
  playCard as playCardAction,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import {
  CANDY_VALUES,
  CANDY_TYPES,
  PARADE_CARD_BY_ID,
  PARADE_SEQUENCE,
  SPECIAL_REWARDS,
} from './content';
import type { CandyCounts, LaParadeSucreeState } from './state';

const HAND = 'players';
const DECK = 'parade';
type RuleContext = GameContext<LaParadeSucreeState>;

export const playCard = playCardAction<LaParadeSucreeState>({
  deckId: DECK,
  handId: HAND,
  validate: ({ actor, input, ctx }) =>
    ctx.cards.hand<string>(HAND, actor.id).includes(input.cardId) &&
    PARADE_CARD_BY_ID[input.cardId]?.value ===
      PARADE_SEQUENCE[sequenceIndex(ctx)],
  enumerate: ({ actor, ctx }) => {
    const expected = PARADE_SEQUENCE[sequenceIndex(ctx)];
    return ctx.cards
      .hand<string>(HAND, actor.id)
      .filter((cardId) => PARADE_CARD_BY_ID[cardId]?.value === expected)
      .map((cardId) => ({ cardId }));
  },
  afterPlay: ({ playerId, cardId, ctx }) => {
    const card = PARADE_CARD_BY_ID[cardId];
    if (!card) rejectRule('Carte de parade inconnue');
    ctx.events.message('game.card.played', {
      playerId,
      cardId,
      value: card.value,
    });
    const reward = SPECIAL_REWARDS[card.value];
    if (reward) {
      for (const candyType of CANDY_TYPES) {
        const amount = reward[candyType];
        if (amount == null) continue;
        ctx.resources.add(playerId, candyResource(candyType), amount ?? 0);
      }
      ctx.events.message('parade.candies.won', {
        playerId,
        score: scoreCandies(reward),
        candies: reward,
      });
    }
  },
});

export const pass = defineAction<LaParadeSucreeState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ actor, ctx }) => {
    ctx.events.message('game.player.passed', { playerId: actor.id });
    ctx.turn.end();
  },
});

export const PARADE_ACTIONS = { play_card: playCard, pass };

export function scoreCandies(
  candies: Partial<CandyCounts> | undefined,
): number {
  return CANDY_TYPES.reduce(
    (total, type) => total + (candies?.[type] ?? 0) * CANDY_VALUES[type],
    0,
  );
}

export function winners(ctx: RuleContext): number[] {
  return ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    { value: (playerId) => scoreCandies(candyCounts(playerId, ctx)) },
  );
}

export function sequenceIndex(ctx: RuleContext): number {
  return ctx.cards.discardCount(DECK);
}

export function playedCards(ctx: RuleContext): string[] {
  return ctx.cards.discardPile<string>(DECK);
}

export function candyCounts(playerId: number, ctx: RuleContext): CandyCounts {
  return {
    Chamallow: ctx.resources.get(playerId, candyResource('Chamallow')),
    Chocobon: ctx.resources.get(playerId, candyResource('Chocobon')),
    Balisto: ctx.resources.get(playerId, candyResource('Balisto')),
  };
}

function candyResource(type: keyof CandyCounts): string {
  return `parade.candy.${type}`;
}
