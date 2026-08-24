import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  ToutPresDeMamanMetadata,
  ToutPresDeMamanTile,
} from '../../model/tout-pres-de-maman-state.model';

export function getToutPresDeMamanTileByIndex(
  meta: ToutPresDeMamanMetadata,
  index: number,
): ToutPresDeMamanTile | null {
  return meta.tiles?.[index] ?? null;
}

export function getToutPresDeMamanPlayerPosition(
  meta: ToutPresDeMamanMetadata,
  playerId: number,
): number {
  return meta.positions?.[playerId] ?? 0;
}

export function describeToutPresDeMamanPawnLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === playerId) ?? null;
  const pawn = typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
  return pawn || 'pion';
}
