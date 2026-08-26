import { defineAction, gameInput } from '../../../core/application/public-api';
import {
  CANDY_VALUES,
  PARADE_CARD_BY_ID,
  PARADE_SEQUENCE,
  SPECIAL_REWARDS,
} from './content';
import type { CandyCounts, LaParadeSucreeState } from './state';

const HAND = 'players';
const DECK = 'parade';

export const playCard = defineAction<LaParadeSucreeState, { cardId: string }>({
  input: gameInput.object({ cardId: gameInput.cardId() }),
  availableInputs: ({ state, actor, ctx }) => {
    const expected = PARADE_SEQUENCE[state.sequenceIndex];
    return ctx.cards
      .hand<string>(HAND, actor.id)
      .filter((cardId) => PARADE_CARD_BY_ID[cardId]?.value === expected)
      .map((cardId) => ({ cardId }));
  },
  execute: ({ state, actor, input, ctx }) => {
    const card = PARADE_CARD_BY_ID[input.cardId];
    if (!card) throw new Error('Carte de parade inconnue');
    ctx.cards.play(HAND, DECK, actor.id, input.cardId);
    state.played.push(input.cardId);
    state.sequenceIndex += 1;
    ctx.history.add(`${actor.username} pose ${card.name} (${card.value}).`);
    const reward = SPECIAL_REWARDS[card.value];
    if (reward) {
      const candies = state.candies[actor.id];
      for (const [type, amount] of Object.entries(reward)) {
        const candyType = type as keyof CandyCounts;
        candies[candyType] += amount ?? 0;
      }
      ctx.history.add(
        `${actor.username} rafle les friandises (+${scoreCandies(reward)}).`,
      );
    }
  },
  documentation: 'Joue la carte de la prochaine valeur attendue.',
});

export const pass = defineAction<LaParadeSucreeState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ actor, ctx }) => {
    ctx.history.add(`${actor.username} passe son tour.`);
    ctx.turn.end();
  },
});

export const PARADE_ACTIONS = { play_card: playCard, pass };

export function scoreCandies(
  candies: Partial<CandyCounts> | undefined,
): number {
  return (Object.keys(CANDY_VALUES) as Array<keyof CandyCounts>).reduce(
    (total, type) => total + (candies?.[type] ?? 0) * CANDY_VALUES[type],
    0,
  );
}

export function winners(state: LaParadeSucreeState): number[] {
  const scores = Object.entries(state.candies).map(([playerId, candies]) => ({
    playerId: Number(playerId),
    score: scoreCandies(candies),
  }));
  const best = Math.max(...scores.map(({ score }) => score));
  return scores
    .filter(({ score }) => score === best)
    .map(({ playerId }) => playerId);
}
