import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import type {
  FouleesFantastiquesMetadata,
  FouleesFantastiquesPawnState,
} from '../../model/foulees-fantastiques-state.model';

export function describeFouleesProgress(
  meta: FouleesFantastiquesMetadata,
  playerId: number,
  progress: number,
): string {
  if (!Number.isFinite(progress) || progress < 0) {
    return 'départ';
  }
  const arrivalProgress = meta.trackLength + meta.homeLength - 1;
  if (progress >= arrivalProgress) {
    return 'arrivée';
  }
  if (progress < meta.trackLength) {
    const offset = meta.offsets?.[playerId] ?? 0;
    const pos = (offset + progress) % meta.trackLength;
    return `case ${pos + 1}/${meta.trackLength}`;
  }
  const homeIndex = progress - meta.trackLength + 1;
  return `abri ${homeIndex}/${meta.homeLength}`;
}

export function describeFouleesPawnLabel(
  state: GameStateEntity,
  playerId: number,
  pawnIndex: number,
): string {
  const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
  const list = meta?.pawnNamesByPlayer?.[playerId];
  const name =
    Array.isArray(list) && typeof list[pawnIndex] === 'string'
      ? String(list[pawnIndex]).trim()
      : '';
  if (name) return name;
  return `animal ${pawnIndex + 1}`;
}

export function describeFouleesOwnedPawnLabel(
  state: GameStateEntity,
  playerId: number,
  pawnIndex: number,
): string {
  const base = describeFouleesPawnLabel(state, playerId, pawnIndex);
  const trimmed = String(base ?? '').trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('son ') ||
    lower.startsWith('sa ') ||
    lower.startsWith('ses ')
  ) {
    return trimmed;
  }
  return `son ${trimmed || `animal ${pawnIndex + 1}`}`;
}

export function describeFouleesHabitatLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
  const habitat =
    typeof meta?.habitatByPlayer?.[playerId] === 'string'
      ? String(meta.habitatByPlayer[playerId]).trim()
      : '';
  return habitat || 'abri de départ';
}

export function describeFouleesFromHabitat(habitat: string): string {
  const raw = String(habitat ?? '').trim();
  const h = raw.toLowerCase();
  if (!raw) return "de l'abri de départ";
  if (h === 'écurie' || h === 'ecurie') return "de l'écurie";
  if (h === 'volière' || h === 'voliere') return 'de la volière';
  if (h === 'primaterie') return 'de la primaterie';
  if (h === 'aquarium') return "de l'aquarium";
  if (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(raw)) {
    return `de l'${raw}`;
  }
  return `du ${raw}`;
}

export function isFouleesWinner(
  meta: FouleesFantastiquesMetadata,
  playerId: number,
  pathLen: number,
): boolean {
  const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
    ? meta.pawnsByPlayer[playerId]
    : [];
  if (pawns.length !== 4) return false;
  return pawns.every(
    (pawn: FouleesFantastiquesPawnState) =>
      typeof pawn?.progress === 'number' && pawn.progress >= pathLen,
  );
}
