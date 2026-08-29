import type {
  RoomBotState,
  RoomPayload,
  RoomPlayer,
} from '../../../application/models/room-payload.model';

export type RoomSnapshot = {
  players: Map<number, string>;
  spectators: Map<number, string>;
  bots: Map<number, string>;
  ownerId: number | null;
  ownerName: string;
  isPrivate: boolean;
};

export function buildRoomSnapshot(payload: RoomPayload): RoomSnapshot {
  const room = payload.room;
  return {
    players: buildPlayerMap(room.players),
    spectators: buildPlayerMap(room.spectators),
    bots: buildBotMap(room.bots),
    ownerId: room.owner?.id ?? null,
    ownerName: (room.owner?.username ?? '').trim(),
    isPrivate: Boolean(room.isPrivate),
  };
}

export function collectRoomAnnouncementMessages(
  previous: RoomSnapshot | undefined,
  next: RoomSnapshot,
): string[] {
  if (!previous) {
    return [];
  }

  const messages: string[] = [];
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
      messages.push(buildPlayerBecamePlayerMessage(username));
    } else if (previous.players.has(id) && next.spectators.has(id)) {
      const username =
        next.spectators.get(id) ?? previous.players.get(id) ?? '';
      messages.push(buildPlayerBecameSpectatorMessage(username));
    }
  }

  collectPlayerDiffMessages(
    messages,
    previous.players,
    next.players,
    false,
    roleSwitchIds,
  );
  collectPlayerDiffMessages(
    messages,
    previous.spectators,
    next.spectators,
    true,
    roleSwitchIds,
  );
  collectBotDiffMessages(messages, previous.bots, next.bots);

  if (
    previous.ownerId !== next.ownerId ||
    previous.ownerName !== next.ownerName
  ) {
    messages.push(
      next.ownerName.length === 0
        ? 'Propriétaire : aucun.'
        : `Nouveau propriétaire : ${next.ownerName}.`,
    );
  }

  if (previous.isPrivate !== next.isPrivate) {
    messages.push(next.isPrivate ? 'Table privée.' : 'Table publique.');
  }

  return messages;
}

function collectPlayerDiffMessages(
  messages: string[],
  previous: Map<number, string>,
  next: Map<number, string>,
  spectator: boolean,
  roleSwitchIds: Set<number>,
): void {
  for (const [id, username] of next.entries()) {
    if (roleSwitchIds.has(id)) {
      continue;
    }
    if (!previous.has(id)) {
      messages.push(buildPlayerJoinedMessage(username, spectator));
    }
  }

  for (const [id, username] of previous.entries()) {
    if (roleSwitchIds.has(id)) {
      continue;
    }
    if (!next.has(id)) {
      messages.push(buildPlayerLeftMessage(username, spectator));
    }
  }
}

function collectBotDiffMessages(
  messages: string[],
  previous: Map<number, string>,
  next: Map<number, string>,
): void {
  for (const [id, name] of next.entries()) {
    if (!previous.has(id)) {
      messages.push(buildBotJoinedMessage(name));
    }
  }

  for (const [id, name] of previous.entries()) {
    if (!next.has(id)) {
      messages.push(buildBotLeftMessage(name));
    }
  }
}

function buildPlayerMap(players?: RoomPlayer[]): Map<number, string> {
  const map = new Map<number, string>();
  if (!players) {
    return map;
  }

  for (const player of players) {
    if (!player || !Number.isFinite(player.id) || player.id <= 0) {
      continue;
    }
    map.set(player.id, (player.username ?? '').trim());
  }

  return map;
}

function buildBotMap(bots?: RoomBotState[]): Map<number, string> {
  const map = new Map<number, string>();
  if (!bots) {
    return map;
  }

  for (const bot of bots) {
    if (!bot || !Number.isFinite(bot.id) || bot.id <= 0) {
      continue;
    }
    map.set(bot.id, (bot.name ?? '').trim());
  }

  return map;
}

function buildPlayerJoinedMessage(name: string, spectator: boolean): string {
  return `${formatPlayerName(name)}${spectator ? ' (spectateur)' : ''} a rejoint la table.`;
}

function buildPlayerBecamePlayerMessage(name: string): string {
  return `${formatPlayerName(name)} est passé en mode joueur.`;
}

function buildPlayerBecameSpectatorMessage(name: string): string {
  return `${formatPlayerName(name)} est passé en mode spectateur.`;
}

function buildPlayerLeftMessage(name: string, spectator: boolean): string {
  return `${formatPlayerName(name)}${spectator ? ' (spectateur)' : ''} a quitté la table.`;
}

function buildBotJoinedMessage(name: string): string {
  return `${formatBotName(name)} a rejoint la table.`;
}

function buildBotLeftMessage(name: string): string {
  return `${formatBotName(name)} a quitté la table.`;
}

function formatPlayerName(name: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Un joueur';
}

function formatBotName(name: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Un bot';
}
