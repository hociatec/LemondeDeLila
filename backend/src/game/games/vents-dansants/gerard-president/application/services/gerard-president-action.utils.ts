import type { GameStateEntity, PlayerStateEntity } from '../../../../../application/models/game-state.model';

import type { GerardPresidentMetadata } from '../../model/gerard-president-state.model';

export function cloneGerardRecordOfArrays(
  source?: Record<number, string[]>,
): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  if (!source) return result;
  Object.entries(source).forEach(([key, value]) => {
    const id = Number(key);
    if (Number.isFinite(id)) {
      result[id] = Array.isArray(value) ? [...value] : [];
    }
  });
  return result;
}

export function cloneGerardNumberRecord(
  source?: Record<number, number[]>,
): Record<number, number[]> {
  const result: Record<number, number[]> = {};
  if (!source) return result;
  Object.entries(source).forEach(([key, value]) => {
    const id = Number(key);
    if (Number.isFinite(id)) {
      result[id] = Array.isArray(value) ? [...value] : [];
    }
  });
  return result;
}

export function cloneGerardMetadata(
  state: GameStateEntity,
): GerardPresidentMetadata {
  const base = (state.metadata ?? {}) as GerardPresidentMetadata;
  return {
    rng: base.rng,
    nameDeck: Array.isArray(base.nameDeck) ? [...base.nameDeck] : [],
    themeDeck: Array.isArray(base.themeDeck) ? [...base.themeDeck] : [],
    specialDeck: Array.isArray(base.specialDeck) ? [...base.specialDeck] : [],
    nameDiscard: Array.isArray(base.nameDiscard) ? [...base.nameDiscard] : [],
    themeDiscard: Array.isArray(base.themeDiscard) ? [...base.themeDiscard] : [],
    specialDiscard: Array.isArray(base.specialDiscard)
      ? [...base.specialDiscard]
      : [],
    hands: cloneGerardRecordOfArrays(base.hands),
    specialHands: cloneGerardRecordOfArrays(base.specialHands),
    scores: { ...(base.scores ?? {}) },
    masterId: base.masterId ?? null,
    currentTheme: base.currentTheme ?? null,
    secondTheme: base.secondTheme ?? null,
    lockedName: base.lockedName ?? null,
    peaceTurnsRemaining: base.peaceTurnsRemaining ?? 0,
    winnerId: base.winnerId ?? null,
    roundNumber: base.roundNumber ?? 0,
    targetScore: base.targetScore ?? 0,
    submissions: cloneGerardRecordOfArrays(base.submissions),
    pendingPlayers: Array.isArray(base.pendingPlayers)
      ? [...base.pendingPlayers]
      : [],
    roundPhase: base.roundPhase ?? 'waiting_theme',
    specialsPlayed: cloneGerardRecordOfArrays(base.specialsPlayed),
    extraNamesAllowed: { ...(base.extraNamesAllowed ?? {}) },
    defenseActive: { ...(base.defenseActive ?? {}) },
    specialAttackers: cloneGerardNumberRecord(base.specialAttackers),
    themeSecretActive: base.themeSecretActive ?? false,
    juryOverrideId: base.juryOverrideId ?? null,
    dominoRemaining: base.dominoRemaining ?? 0,
    ghostNames: Array.isArray(base.ghostNames) ? [...base.ghostNames] : [],
  };
}

export function getGerardPlayers(state: GameStateEntity): PlayerStateEntity[] {
  return (state.players ?? []).filter((player): player is PlayerStateEntity =>
    Boolean(player?.id),
  );
}

export function formatGerardPlayer(playerId: number | null): string {
  if (playerId == null) return 'un joueur';
  return `Joueur ${playerId}`;
}

export function filterGerardPlayableNames(names: string[]): string[] {
  const unique: string[] = [];
  names.forEach((name) => {
    const clean = name?.trim();
    if (clean && !unique.includes(clean)) {
      unique.push(clean);
    }
  });
  return unique;
}
