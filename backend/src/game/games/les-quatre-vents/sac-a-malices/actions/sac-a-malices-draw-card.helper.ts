import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { SacCard, SacDeck, SacMetadata } from '../model/sac-a-malices.types';
import { shouldKeepSacAMalicesCard } from './sac-a-malices-card-effect.helper';

export function drawSacAMalicesCard(input: {
  meta: SacMetadata;
  deckId: 'chance' | 'community';
  drawFromPile: (
    meta: SacMetadata,
    deck: SacDeck,
  ) => { card: SacCard | null; meta: SacMetadata; pile: SacCard[]; discard: SacCard[] };
}): { card: SacCard | null; meta: SacMetadata } {
  const deck: SacDeck = input.meta.decks?.[input.deckId] ?? {
    cards: [],
    discard: [],
  };
  const draw = input.drawFromPile(input.meta, {
    cards: Array.isArray(deck.cards) ? [...deck.cards] : [],
    discard: Array.isArray(deck.discard) ? [...deck.discard] : [],
  });
  if (!draw.card) {
    const nextMeta: SacMetadata = {
      ...draw.meta,
      decks: {
        ...input.meta.decks,
        [input.deckId]: { cards: draw.pile, discard: draw.discard },
      },
    };
    return { card: null, meta: nextMeta };
  }

  const keep = shouldKeepSacAMalicesCard(draw.card);
  const nextDeck = keep
    ? { cards: draw.pile, discard: draw.discard }
    : { cards: draw.pile, discard: [...draw.discard, draw.card] };
  const nextMeta: SacMetadata = {
    ...draw.meta,
    decks: { ...input.meta.decks, [input.deckId]: nextDeck },
  };
  return { card: draw.card, meta: nextMeta };
}

export function applySacAMalicesDrawAndApply(input: {
  state: GameStateEntity;
  playerId: number;
  deckId: 'chance' | 'community';
  getMeta: (state: GameStateEntity) => SacMetadata;
  drawCard: (
    meta: SacMetadata,
    deckId: 'chance' | 'community',
  ) => { card: SacCard | null; meta: SacMetadata };
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  applyCard: (
    state: GameStateEntity,
    playerId: number,
    deckId: 'chance' | 'community',
    card: SacCard,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  const drawn = input.drawCard(input.getMeta(next), input.deckId);
  next = { ...next, metadata: { ...(next.metadata ?? {}), ...drawn.meta } };
  if (!drawn.card) return next;
  next = input.appendLog(next, `Carte : ${drawn.card.text}`);
  return input.applyCard(next, input.playerId, input.deckId, drawn.card);
}




