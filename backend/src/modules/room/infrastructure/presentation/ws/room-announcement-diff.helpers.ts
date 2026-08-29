import {
  buildBotJoinedMessage,
  buildBotLeftMessage,
  buildPlayerBecamePlayerMessage,
  buildPlayerBecameSpectatorMessage,
  buildPlayerJoinedMessage,
  buildPlayerLeftMessage,
} from './room-announcement-message.helpers';
import type { RoomSnapshot } from './room-announcement.helpers';

export async function emitRoomAnnouncementDiff(params: {
  roomId: number;
  previous: RoomSnapshot;
  next: RoomSnapshot;
  announce: (message: string) => Promise<void>;
}): Promise<void> {
  const { roomId, previous, next, announce } = params;

  const roleSwitchIds = new Set<number>();
  for (const id of previous.players.keys()) {
    if (next.spectators.has(id)) {
      roleSwitchIds.add(id);
    }
  }
  for (const id of previous.spectators.keys()) {
    if (next.players.has(id)) {
      roleSwitchIds.add(id);
    }
  }

  for (const id of roleSwitchIds) {
    if (previous.spectators.has(id) && next.players.has(id)) {
      const username =
        next.players.get(id) ?? previous.spectators.get(id) ?? '';
      await announce(buildPlayerBecamePlayerMessage(username));
    } else if (previous.players.has(id) && next.spectators.has(id)) {
      const username =
        next.spectators.get(id) ?? previous.players.get(id) ?? '';
      await announce(buildPlayerBecameSpectatorMessage(username));
    }
  }

  await emitPlayerDiff(
    roomId,
    previous.players,
    next.players,
    false,
    roleSwitchIds,
    announce,
  );
  await emitPlayerDiff(
    roomId,
    previous.spectators,
    next.spectators,
    true,
    roleSwitchIds,
    announce,
  );
  await emitBotDiff(roomId, previous.bots, next.bots, announce);

  if (
    previous.ownerId !== next.ownerId ||
    previous.ownerName !== next.ownerName
  ) {
    const message =
      next.ownerName.length === 0
        ? 'Propriétaire : aucun.'
        : `Nouveau propriétaire : ${next.ownerName}.`;
    await announce(message);
  }

  if (previous.isPrivate !== next.isPrivate) {
    await announce(next.isPrivate ? 'Table privée.' : 'Table publique.');
  }
}

async function emitPlayerDiff(
  roomId: number,
  previous: Map<number, string>,
  next: Map<number, string>,
  spectator: boolean,
  roleSwitchIds: Set<number>,
  announce: (message: string) => Promise<void>,
): Promise<void> {
  void roomId;
  for (const [id, username] of next.entries()) {
    if (roleSwitchIds.has(id)) {
      continue;
    }
    if (!previous.has(id)) {
      await announce(buildPlayerJoinedMessage(username, spectator));
    }
  }

  for (const [id, username] of previous.entries()) {
    if (roleSwitchIds.has(id)) {
      continue;
    }
    if (!next.has(id)) {
      await announce(buildPlayerLeftMessage(username, spectator));
    }
  }
}

async function emitBotDiff(
  roomId: number,
  previous: Map<number, string>,
  next: Map<number, string>,
  announce: (message: string) => Promise<void>,
): Promise<void> {
  void roomId;
  for (const [id, name] of next.entries()) {
    if (!previous.has(id)) {
      await announce(buildBotJoinedMessage(name));
    }
  }

  for (const [id, name] of previous.entries()) {
    if (!next.has(id)) {
      await announce(buildBotLeftMessage(name));
    }
  }
}
