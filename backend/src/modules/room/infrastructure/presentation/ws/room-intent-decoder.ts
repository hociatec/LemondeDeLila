import { decodeWsEnvelope } from '../../../../../platform/ws/public-api';
import { hasOnlyAllowedKeys } from '../../../../../platform/validation/public-api';
import type { IncomingPayload } from './room-gateway.types';
import {
  RoomWsIntentIdRequiredError,
  RoomWsInvalidMessageError,
  RoomWsUnknownCommandError,
  RoomWsUnknownIntentError,
} from './room-ws.errors';

const MAX_ROOM_MESSAGE_BYTES = 65_536;
const ROOM_INTENTS = new Set([
  'room.leave',
  'room.chat.send',
  'room.chat.history',
  'room.start',
  'room.reset',
  'room.set-role',
  'room.kick',
  'room.ban',
  'room.set-owner',
  'room.set-ambience',
  'room.toggle-privacy',
  'room.info',
  'room.state',
  'room.ping',
  'bot.add',
  'bot.remove',
  'room.create',
  'room.join',
]);

const ROOM_INTENT_KEYS: Readonly<Record<string, readonly string[]>> = {
  'room.leave': [],
  'room.chat.send': ['message'],
  'room.chat.history': [],
  'room.start': ['_trace'],
  'room.reset': ['_trace'],
  'room.set-role': ['roomId', 'spectator'],
  'room.kick': ['userId', 'id', 'targetUserId'],
  'room.ban': ['userId', 'id', 'targetUserId'],
  'room.set-owner': ['userId', 'id', 'newOwnerId'],
  'room.set-ambience': ['soundId', '_trace'],
  'room.toggle-privacy': ['_trace'],
  'room.info': [],
  'room.state': [],
  'room.ping': ['clientSentAtMs', '_trace'],
  'bot.add': ['_trace'],
  'bot.remove': ['botId', 'id', '_trace'],
  'room.create': [
    'gameType',
    'name',
    'maxPlayers',
    'max',
    'isPrivate',
    'payload',
    '_trace',
  ],
  'room.join': ['roomId', 'spectator', 'hidden', '_trace'],
};

export function decodeRoomMessage(raw: unknown): IncomingPayload {
  const envelope = decodeWsEnvelope(raw, MAX_ROOM_MESSAGE_BYTES);
  if (!envelope) throw new RoomWsInvalidMessageError();
  const type = envelope.type.trim();
  if (type !== 'room.intent.execute') throw new RoomWsUnknownCommandError(type);
  return { type, payload: envelope.payload };
}

export function decodeRoomIntent(envelope: Record<string, unknown>): {
  intentId: string;
  commandPayload: Record<string, unknown>;
} {
  if (!hasOnlyAllowedKeys(envelope, ['intentId', 'data', '_trace'])) {
    throw new RoomWsInvalidMessageError();
  }
  const intentIdRaw =
    typeof envelope.intentId === 'string' ? envelope.intentId : '';
  const intentId = intentIdRaw.trim().toLowerCase();
  if (intentId.length === 0 || intentId.length > 128) {
    throw new RoomWsIntentIdRequiredError();
  }

  if (!ROOM_INTENTS.has(intentId)) {
    throw new RoomWsUnknownIntentError(intentId);
  }

  const commandPayload: Record<string, unknown> =
    Object.prototype.hasOwnProperty.call(envelope, 'data') &&
    envelope.data != null &&
    typeof envelope.data === 'object' &&
    !Array.isArray(envelope.data)
      ? { ...(envelope.data as Record<string, unknown>) }
      : {};

  if (
    !Object.prototype.hasOwnProperty.call(commandPayload, '_trace') &&
    envelope._trace != null &&
    typeof envelope._trace === 'object' &&
    !Array.isArray(envelope._trace)
  ) {
    commandPayload._trace = envelope._trace;
  }

  const allowedKeys = ROOM_INTENT_KEYS[intentId];
  if (
    !allowedKeys ||
    !hasOnlyAllowedKeys(commandPayload, [...allowedKeys, '_trace'])
  ) {
    throw new RoomWsInvalidMessageError();
  }
  if (
    intentId === 'room.create' &&
    Object.prototype.hasOwnProperty.call(commandPayload, 'payload') &&
    !hasOnlyAllowedKeys(commandPayload.payload, [
      'gameType',
      'name',
      'maxPlayers',
      'max',
      'isPrivate',
    ])
  ) {
    throw new RoomWsInvalidMessageError();
  }

  return { intentId, commandPayload };
}
