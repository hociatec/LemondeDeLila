import type {
  GameEvent,
  GamePendingEvent,
  ProjectedGameEvent,
  ProjectedGamePendingEvent,
} from '../contracts/game-event.model';

export function projectPendingGameEvent(
  event: GamePendingEvent,
  viewerPlayerId: number | null,
): ProjectedGamePendingEvent | null {
  return projectVisibleEvent(event, viewerPlayerId);
}

export function projectGameEvent(
  event: GameEvent,
  viewerPlayerId: number | null,
): ProjectedGameEvent | null {
  return projectVisibleEvent(event, viewerPlayerId);
}

function projectVisibleEvent<TEvent extends GamePendingEvent>(
  event: TEvent,
  viewerPlayerId: number | null,
): Omit<TEvent, 'visibility'> | null {
  const visibility = event.visibility;
  if (visibility.kind === 'internal') return null;
  if (
    visibility.kind === 'private' &&
    (viewerPlayerId == null || !visibility.playerIds.includes(viewerPlayerId))
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
