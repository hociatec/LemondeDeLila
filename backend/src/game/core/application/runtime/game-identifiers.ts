import type { PlayerStateEntity } from '../models/game-state.model';
import { GamePayloadValidationError } from '../../domain/errors/game-domain.errors';

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
  if (!Number.isInteger(value) || value < 1) {
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
  players: readonly PlayerStateEntity[],
  initial: TValue | ((player: PlayerStateEntity) => TValue),
): PlayerMap<TValue> {
  return Object.fromEntries(
    players.map((player) => [
      String(player.id),
      structuredClone(
        typeof initial === 'function'
          ? (initial as (player: PlayerStateEntity) => TValue)(player)
          : initial,
      ),
    ]),
  );
}

function nonEmptyId(value: string, kind: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GamePayloadValidationError(`Identifiant de ${kind} vide`);
  }
  return normalized;
}
