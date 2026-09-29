export type MessageSystemView = {
  match: { status: unknown };
  players: {
    all: Array<{ id: number; username: string } & Record<string, unknown>>;
  };
  events: {
    recent: unknown[];
    latestByType: Record<string, unknown>;
  };
} & Record<string, unknown>;

/** Decodes the dynamic game projection once at the WebSocket boundary. */
export function decodeMessageSystem(value: unknown): MessageSystemView {
  const system = asUnknownRecord(value);
  const match = asUnknownRecord(system.match);
  const players = asUnknownRecord(system.players);
  const events = asUnknownRecord(system.events);
  return {
    ...system,
    match: { ...match, status: match.status },
    players: {
      ...players,
      all: (Array.isArray(players.all) ? players.all : []).flatMap((value) => {
        const player = asUnknownRecord(value);
        return typeof player.id === 'number' &&
          typeof player.username === 'string'
          ? [{ ...player, id: player.id, username: player.username }]
          : [];
      }),
    },
    events: {
      ...events,
      recent: Array.isArray(events.recent) ? events.recent : [],
      latestByType: asUnknownRecord(events.latestByType),
    },
  };
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
