import type {
  GameEvent,
  ProjectedGameEvent,
} from '../models/game-event.model';

export function projectGameEvent(
  event: GameEvent,
  viewerPlayerId: number | null,
): ProjectedGameEvent | null {
  const visibility = event.visibility;
  if (visibility.kind === 'internal') return null;
  if (
    visibility.kind === 'private' &&
    (viewerPlayerId == null ||
      !visibility.playerIds.includes(viewerPlayerId))
  ) {
    return null;
  }

  const { visibility: _visibility, ...projected } = structuredClone(event);
  if (visibility.kind !== 'split' || viewerPlayerId == null) return projected;
  const privateData =
    visibility.privateDataByPlayer[String(viewerPlayerId)] ?? {};
  return {
    ...projected,
    data: { ...projected.data, ...structuredClone(privateData) },
  };
}
