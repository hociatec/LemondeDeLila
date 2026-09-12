import type { PlayerState } from '../../core/application/models/game-state.model';
import { GamePayloadValidationError } from '../../core/domain/errors/game-domain.errors';

declare const playerIdBrand: unique symbol;
declare const cardIdBrand: unique symbol;
declare const pawnIdBrand: unique symbol;
declare const tileIdBrand: unique symbol;

export type PlayerId = number & { readonly [playerIdBrand]: true };
export type CardId = string & { readonly [cardIdBrand]: true };
export type PawnId = string & { readonly [pawnIdBrand]: true };
export type TileId = string & { readonly [tileIdBrand]: true };
export type PlayerMap<TValue> = Record<string, TValue>;

export function playerId(value: number): PlayerId {
  if (!Number.isSafeInteger(value) || value === 0) {
    throw new GamePayloadValidationError(
      `Identifiant de joueur invalide: ${value}`,
    );
  }
  return value as PlayerId;
}

export function cardId(value: string): CardId {
  return nonEmptyId(value, 'carte') as CardId;
}

export function pawnId(value: string): PawnId {
  return nonEmptyId(value, 'pion') as PawnId;
}

export function tileId(value: string): TileId {
  return nonEmptyId(value, 'case') as TileId;
}

export function playerMap<TValue>(
  players: readonly PlayerState[],
  initial: TValue | ((player: PlayerState) => TValue),
): PlayerMap<TValue> {
  if (!Array.isArray(players) || players.length > 128) {
    throw new GamePayloadValidationError('Liste de joueurs invalide');
  }
  if (
    players.some(
      (player: PlayerState) =>
        !player ||
        !Number.isSafeInteger(player.id) ||
        player.id === 0 ||
        typeof player.username !== 'string' ||
        player.username.length > 255,
    )
  ) {
    throw new GamePayloadValidationError('Joueur invalide');
  }
  return Object.fromEntries(
    players.map((player: PlayerState) => [
      String(player.id),
      structuredClone(
        typeof initial === 'function'
          ? (initial as (player: PlayerState) => TValue)(player)
          : initial,
      ),
    ]),
  );
}

function nonEmptyId(value: string, kind: string): string {
  if (typeof value !== 'string' || value.length > 128) {
    throw new GamePayloadValidationError(`Identifiant de ${kind} trop long`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new GamePayloadValidationError(`Identifiant de ${kind} vide`);
  }
  return normalized;
}
