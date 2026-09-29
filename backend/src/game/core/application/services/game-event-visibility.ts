import type {
  GameEvent,
  GamePendingEvent,
  ProjectedGameEvent,
  ProjectedGamePendingEvent,
} from '../models/game-event.model';
import {
  assertPendingGameEvent,
  assertStoredGameEvent,
  GAME_EVENT_SCHEMA_VERSION,
} from './game-event-contract';

export function projectPendingGameEvent(
  event: GamePendingEvent,
  viewerPlayerId: number | null,
): ProjectedGamePendingEvent | null {
  assertPendingGameEvent(event);
  return projectVisibleEvent(event, viewerPlayerId);
}

export function projectGameEvent(
  event: GameEvent,
  viewerPlayerId: number | null,
): ProjectedGameEvent | null {
  assertStoredGameEvent(event);
  const projected = projectVisibleEvent(event, viewerPlayerId);
  return projected === null
    ? null
    : {
        ...projected,
        seq: event.seq,
        version: event.version,
        schemaVersion: event.schemaVersion ?? GAME_EVENT_SCHEMA_VERSION,
      };
}

function projectVisibleEvent(
  event: GamePendingEvent,
  viewerPlayerId: number | null,
): ProjectedGamePendingEvent | null {
  if (
    viewerPlayerId !== null &&
    (!Number.isSafeInteger(viewerPlayerId) || viewerPlayerId <= 0)
  )
    viewerPlayerId = null;
  const visibility = event.visibility;
  if (visibility.kind === 'internal') return null;
  if (
    visibility.kind === 'private' &&
    (viewerPlayerId == null || !visibility.playerIds.includes(viewerPlayerId))
  )
    return null;
  const projected = {
    actorId: event.actorId,
    type: event.type,
    occurredAtMs: event.occurredAtMs,
    data: projectEventData(event.type, event.data, viewerPlayerId),
  };
  if (visibility.kind !== 'split' || viewerPlayerId == null) return projected;
  const privateData =
    visibility.privateDataByPlayer[String(viewerPlayerId)] ?? {};
  return {
    ...projected,
    data: { ...projected.data, ...structuredClone(privateData) },
  };
}

/** Player-specific narration is selected at the trusted server boundary. */
function projectEventData(
  type: string,
  source: object,
  viewerPlayerId: number | null,
): Record<string, unknown> {
  const data = structuredClone(source) as Record<string, unknown>;
  if (type !== 'game.message') return data;
  const narration = record(data.narration);
  if (!narration) return data;
  const variants = record(narration.byPlayerId);
  const selected =
    viewerPlayerId == null || !variants
      ? undefined
      : variants[String(viewerPlayerId)];
  data.narration = {
    ...narration,
    ...(typeof selected === 'string'
      ? { byPlayerId: { [String(viewerPlayerId)]: selected } }
      : {}),
  };
  if (typeof selected !== 'string')
    Reflect.deleteProperty(data.narration as object, 'byPlayerId');
  return data;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
