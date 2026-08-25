import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import type { SacMetadata, SacTile } from '../../model/sac-a-malices.types';

export function asSacRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toSacStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function toSacNumberValue(value: unknown): number | null {
  const candidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length
        ? Number(value.trim())
        : NaN;
  return Number.isFinite(candidate) ? candidate : null;
}

export type SacPlayerState = {
  id: number;
  pawn?: string;
  pawnLabel?: string;
};

type SacRulesRecord = NonNullable<SacMetadata['rules']>;

export function resolveSacRules(
  meta: SacMetadata,
): NonNullable<SacMetadata['rules']> {
  const defaults: NonNullable<SacMetadata['rules']> = {
    startMoney: 2000,
    passStartBonus: 200,
    potEnabled: true,
    rentBlockedInJail: true,
    jail: {
      maxTurns: 3,
      autoFine: 100,
      allowPayFine: true,
      allowDoubleEscape: false,
    },
  };
  const rules = (meta.rules ?? {}) as Partial<SacRulesRecord>;
  return {
    ...defaults,
    ...rules,
    jail: { ...defaults.jail, ...(rules.jail ?? {}) },
  };
}

export function advanceSacTurn(
  state: GameStateEntity,
  meta: SacMetadata,
): GameStateEntity {
  const players = Array.isArray(state.players) ? state.players : [];
  if (!players.length) return state;
  const statuses = meta.statuses;
  const skipTurn = { ...(statuses.skipTurn ?? {}) };
  const eliminated = statuses.eliminated ?? {};

  const currentId = state.turn?.currentPlayerId ?? null;
  const currentIndex =
    currentId != null
      ? players.findIndex((p: SacPlayerState) => p?.id === currentId)
      : state.turnIndex;

  let nextIndex = currentIndex >= 0 ? currentIndex : state.turnIndex;
  let attempts = 0;
  let nextPlayerId = players[nextIndex]?.id ?? players[0].id;

  do {
    nextIndex = (nextIndex + 1) % players.length;
    const pid = players[nextIndex].id;
    if (eliminated?.[pid]) {
      attempts += 1;
      continue;
    }
    const remaining = skipTurn[pid] ?? 0;
    if (remaining > 0) {
      skipTurn[pid] = remaining - 1;
      attempts += 1;
      continue;
    }
    nextPlayerId = pid;
    break;
  } while (attempts < players.length);

  return {
    ...state,
    turnIndex: nextIndex,
    turn: { currentPlayerId: nextPlayerId, direction: 1 },
    metadata: {
      ...(state.metadata ?? {}),
      ...meta,
      statuses: { ...statuses, skipTurn },
    },
  };
}

export function getSacPawnLabel(state: GameStateEntity, id: number): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((p: SacPlayerState) => p?.id === id);

  const explicitLabel = String(player?.pawnLabel ?? '').trim();
  if (explicitLabel) return `"${explicitLabel}"`;

  const pawnId = String(player?.pawn ?? '').trim();
  if (pawnId) return `"${pawnId}"`;

  const fallback = resolvePlayerNameFromState(state, id);
  return `"${fallback}"`;
}

export function clampSacValue(
  value: number,
  min: number,
  max: number,
): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function stripSacParens(text: string): string {
  return String(text ?? '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

export function normalizeSacText(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ');
}

export function findSacJailTile(tiles: SacTile[] | undefined): number | null {
  const list = Array.isArray(tiles) ? tiles : [];
  const idx = list.findIndex((tile) => tile?.type === 'jail');
  return idx >= 0 ? idx : null;
}

export function findSacTileByName(
  tiles: SacTile[] | undefined,
  rawName: string,
): number | null {
  const name = normalizeSacText(rawName);
  if (!name) return null;
  const list = Array.isArray(tiles) ? tiles : [];
  const idx = list.findIndex((tile) =>
    normalizeSacText(stripSacParens(tile?.title ?? '')).includes(name),
  );
  return idx >= 0 ? idx : null;
}
