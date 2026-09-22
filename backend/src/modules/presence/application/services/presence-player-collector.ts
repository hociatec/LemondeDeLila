import type { PresenceClient } from '../models/presence-client.model';
import {
  type PresenceBroadcastPlayer,
  type PresenceConnectionContext,
  scorePresenceActivity,
} from './presence-state.utils';

/** Selects the foreground connection for each local user without touching remote origins. */
export function collectPresencePlayers(
  clients: Iterable<PresenceClient>,
  now: () => number,
): Map<number, PresenceBroadcastPlayer> {
  const playersByUser = new Map<number, PresenceBroadcastPlayer>();
  for (const client of clients) {
    const { user, context, roomHint, contextLocked } = client;
    const activity: PresenceConnectionContext = context ?? 'home';
    const candidate: PresenceBroadcastPlayer = {
      id: user.id,
      username: user.username,
      currentRoom: roomHint
        ? { id: roomHint.id, name: roomHint.name ?? `Table #${roomHint.id}` }
        : null,
      activity,
      contextLocked,
      lastInteractionAt: client.lastInteractionAt ?? now(),
      roomStarted: null,
    };
    const existing = playersByUser.get(user.id);
    if (!existing) {
      playersByUser.set(user.id, candidate);
      continue;
    }
    // An idle transport (notably the persistent chat subscription) must not
    // override the screen explicitly reported by the foreground client.
    if (existing.contextLocked && !candidate.contextLocked) continue;
    if (candidate.contextLocked && !existing.contextLocked) {
      playersByUser.set(user.id, candidate);
      continue;
    }
    const currentScore = scorePresenceActivity(existing.activity);
    const candidateScore = scorePresenceActivity(candidate.activity);
    if (
      (candidate.lastInteractionAt ?? 0) > (existing.lastInteractionAt ?? 0) ||
      (candidate.lastInteractionAt === existing.lastInteractionAt &&
        candidateScore < currentScore)
    ) {
      playersByUser.set(user.id, candidate);
      continue;
    }
    if (
      candidateScore === currentScore &&
      candidate.lastInteractionAt === existing.lastInteractionAt
    ) {
      existing.contextLocked =
        existing.contextLocked || candidate.contextLocked;
      if (!existing.currentRoom && candidate.currentRoom) {
        existing.currentRoom = candidate.currentRoom;
      }
      if (
        typeof candidate.lastInteractionAt === 'number' &&
        candidate.lastInteractionAt > (existing.lastInteractionAt ?? 0)
      ) {
        existing.lastInteractionAt = candidate.lastInteractionAt;
      }
    }
  }
  return playersByUser;
}
