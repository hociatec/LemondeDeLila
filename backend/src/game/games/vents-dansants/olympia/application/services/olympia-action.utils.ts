import type { OlympiaDeckType } from '../../model/olympia-cards';
import type { OlympiaMetadata } from '../../model/olympia-state.model';

export function drawOneOlympiaCard(
  meta: OlympiaMetadata,
  deck: OlympiaDeckType,
): { cardId: string | null; meta: OlympiaMetadata } {
  const pile = [...(meta.decks?.[deck] ?? [])];
  if (!pile.length) return { cardId: null, meta };
  const [cardId, ...rest] = pile;
  return {
    cardId,
    meta: { ...meta, decks: { ...meta.decks, [deck]: rest } },
  };
}

export function removeOlympiaCardFromHand(
  meta: OlympiaMetadata,
  playerId: number,
  cardId: string,
): OlympiaMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
  const index = playerHand.indexOf(cardId);
  if (index >= 0) playerHand.splice(index, 1);
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function addOlympiaCardToHand(
  meta: OlympiaMetadata,
  playerId: number,
  cardId: string,
): OlympiaMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? []), cardId];
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function addOlympiaCardToDiscard(
  meta: OlympiaMetadata,
  cardId: string,
): OlympiaMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}
