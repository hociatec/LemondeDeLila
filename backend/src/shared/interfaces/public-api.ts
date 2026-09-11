export type { WsAuthPayload } from './ws-auth-payload';
declare const userIdBrand: unique symbol;
declare const roomIdBrand: unique symbol;
declare const gameIdBrand: unique symbol;
declare const messageIdBrand: unique symbol;

export type UserId = number & { readonly [userIdBrand]: 'UserId' };
export type RoomId = number & { readonly [roomIdBrand]: 'RoomId' };
export type GameId = string & { readonly [gameIdBrand]: 'GameId' };
export type MessageId = string & { readonly [messageIdBrand]: 'MessageId' };

export function asUserId(value: number): UserId {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new RangeError('Identifiant utilisateur invalide');
  return value as UserId;
}

export function asRoomId(value: number): RoomId {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new RangeError('Identifiant room invalide');
  return value as RoomId;
}

export function asMessageId(value: string): MessageId {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128)
    throw new RangeError('Identifiant message invalide');
  return normalized as MessageId;
}

export function asGameId(value: string): GameId {
  const normalized = value.trim();
  if (!/^[a-z][a-z0-9-]{0,95}$/.test(normalized))
    throw new RangeError('Identifiant jeu invalide');
  return normalized as GameId;
}
export { BUSINESS_CLOCK, type BusinessClock } from './business-clock';
