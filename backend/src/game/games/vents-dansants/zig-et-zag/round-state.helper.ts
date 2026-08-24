import type {
  ZigEtZagMetadata,
  ZigEtZagPlayerPlay,
  ZigEtZagRoundState,
} from './model/zig-et-zag-state.model';
import { ZIG_ET_ZAG_CARD_BY_ID } from './model/zig-et-zag-cards';

export function buildInitialRoundState(
  metadata: ZigEtZagMetadata,
  players: Array<{ id?: number | null }>,
): ZigEtZagRoundState {
  const playerIds = players
    .map((player) => player?.id)
    .filter((id): id is number => typeof id === 'number');

  const plays: ZigEtZagPlayerPlay[] = playerIds.map((playerId) => ({
    playerId,
    playedCards: [],
  }));

  const waitingPlayers = playerIds.filter(
    (playerId) => getPlayerHandSize(metadata, playerId) > 0,
  );

  playerIds
    .filter((playerId) => !waitingPlayers.includes(playerId))
    .forEach((playerId) => {
      const entry = plays.find((play) => play.playerId === playerId);
      if (entry) {
        entry.lostByNoCard = true;
      }
    });

  return {
    stage: 'selection',
    plays,
    waitingPlayers,
    tiedPlayers: [],
    triggerColors: {},
    triggerFamilies: {},
    battleLog: [],
  };
}

export function getPlayerHand(
  metadata: ZigEtZagMetadata,
  playerId: number,
): string[] {
  const decks = metadata.playerDecks ?? {};
  const hand = Array.isArray(decks[playerId]) ? [...decks[playerId]] : [];
  return hand;
}

export function getPlayerHandSize(
  metadata: ZigEtZagMetadata,
  playerId: number,
): number {
  return getPlayerHand(metadata, playerId).length;
}

export function playerHasCard(
  metadata: ZigEtZagMetadata,
  playerId: number,
  cardId: string,
): boolean {
  return getPlayerHand(metadata, playerId).includes(cardId);
}

export function removeCardFromHand(
  metadata: ZigEtZagMetadata,
  playerId: number,
  cardId: string,
): { metadata: ZigEtZagMetadata; removed: boolean } {
  const decks = { ...(metadata.playerDecks ?? {}) };
  const hand = Array.isArray(decks[playerId]) ? [...decks[playerId]] : [];
  const index = hand.indexOf(cardId);
  if (index < 0) {
    return { metadata, removed: false };
  }
  hand.splice(index, 1);
  decks[playerId] = hand;
  return {
    metadata: {
      ...metadata,
      playerDecks: decks,
    },
    removed: true,
  };
}

export function getSelectableCards(
  metadata: ZigEtZagMetadata,
  playerId: number,
): string[] {
  const round = metadata.roundState;
  if (!round) return [];

  // Robustness: some stores/serializers can round-trip number ids as strings.
  const waiting = ((round.waitingPlayers ?? []) as unknown[])
    .map((v) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })
    .filter((v): v is number => typeof v === 'number');

  if (!waiting.includes(playerId)) return [];
  return getPlayerHand(metadata, playerId).filter((cardId) =>
    isCardAllowed(round, playerId, cardId),
  );
}

export function isCardAllowed(
  round: ZigEtZagRoundState,
  playerId: number,
  cardId: string,
): boolean {
  if (round.stage === 'selection') {
    return true;
  }
  const definition = ZIG_ET_ZAG_CARD_BY_ID[cardId];
  if (!definition) return false;
  if (definition.type !== 'joker') {
    return true;
  }
  const color = round.triggerColors[playerId];
  const family = round.triggerFamilies[playerId];
  if (!color || !family) {
    return false;
  }
  return (
    definition.color === color &&
    Array.isArray(definition.allowedFamilies) &&
    definition.allowedFamilies.includes(family)
  );
}
