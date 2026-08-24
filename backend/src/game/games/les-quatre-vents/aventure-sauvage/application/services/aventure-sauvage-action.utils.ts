import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import type {
  AventureSauvageCard,
  AventureSauvageMetadata,
} from '../../model/aventure-sauvage-state.model';

export type AventureRuntimeMetadata = AventureSauvageMetadata & {
  rng?: Record<string, unknown>;
  aventureReroll?: boolean;
};

export function asAventureRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toAventureText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function asAventurePendingRecord(value: unknown): {
  type?: string;
  playerId?: unknown;
  data?: Record<string, unknown>;
} | null {
  if (!value || typeof value !== 'object') return null;
  const record = asAventureRecord(value);
  return {
    type: toAventureText(record.type),
    playerId: record.playerId,
    data: asAventureRecord(record.data),
  };
}

export function normalizeAventureMeta(input: unknown): AventureRuntimeMetadata {
  const raw = asAventureRecord(input);
  return {
    rng: asAventureRecord(raw.rng),
    tiles: Array.isArray(raw.tiles)
      ? (raw.tiles as AventureSauvageMetadata['tiles'])
      : [],
    positions: asAventureRecord(raw.positions) as Record<number, number>,
    pawns: Array.isArray(raw.pawns)
      ? (raw.pawns as AventureSauvageMetadata['pawns'])
      : [],
    pawnByPlayerId:
      (asAventureRecord(raw.pawnByPlayerId) as Record<number, string>) ?? {},
    setupStarterId:
      typeof raw.setupStarterId === 'number' ? raw.setupStarterId : null,
    statuses: {
      skipTurn:
        (asAventureRecord(asAventureRecord(raw.statuses).skipTurn) as Record<
          number,
          number
        >) ?? {},
    },
    winnerId: typeof raw.winnerId === 'number' ? raw.winnerId : null,
    decks: {
      animal: Array.isArray(asAventureRecord(raw.decks).animal)
        ? (asAventureRecord(raw.decks).animal as AventureSauvageCard[])
        : [],
      patte: Array.isArray(asAventureRecord(raw.decks).patte)
        ? (asAventureRecord(raw.decks).patte as AventureSauvageCard[])
        : [],
      discardAnimal: Array.isArray(asAventureRecord(raw.decks).discardAnimal)
        ? (asAventureRecord(raw.decks).discardAnimal as AventureSauvageCard[])
        : [],
      discardPatte: Array.isArray(asAventureRecord(raw.decks).discardPatte)
        ? (asAventureRecord(raw.decks).discardPatte as AventureSauvageCard[])
        : [],
    },
    aventureReroll: raw.aventureReroll === true,
  };
}

export function clampAventureMove(value: number, tilesLen: number): number {
  const max = Math.max(1, tilesLen) - 1;
  if (value <= 0) return 0;
  if (value >= max) return max;
  return value;
}

export function lowercaseAventureFirst(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return text;
  if (text.length === 1) return text.toLowerCase();
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function describeAventurePawnLabel(
  state: GameStateEntity,
  meta: AventureRuntimeMetadata,
  playerId: number,
): string {
  const pawnId = toAventureText(meta.pawnByPlayerId?.[playerId]);
  const pawn = Array.isArray(meta.pawns)
    ? meta.pawns.find((entry) => toAventureText(entry?.id) === pawnId)
    : null;
  const title = toAventureText(pawn?.label);
  if (title) return `"${title}"`;
  return 'un pion';
}

export function describeAventurePawnPossessive(
  state: GameStateEntity,
  meta: AventureRuntimeMetadata,
  playerId: number,
): string {
  const raw = describeAventurePawnLabel(state, meta, playerId);
  const inner = String(raw ?? '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim();
  if (!inner) return '"son pion"';
  const stripped = inner
    .replace(/^(le|la|les|un|une)\s+/i, '')
    .replace(/^l[']\s*/i, '')
    .trim();
  const base = lowercaseAventureFirst(stripped || inner);
  const feminine = /^(la|une)\s+/i.test(inner);
  const possessive = feminine ? 'sa' : 'son';
  return `"${possessive} ${base}"`;
}
