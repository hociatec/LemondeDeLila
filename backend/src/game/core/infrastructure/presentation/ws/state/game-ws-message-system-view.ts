export type MessageEventNarration = {
  default?: string;
  byPlayerId?: Readonly<Record<string, string>>;
  supersedes?: readonly string[];
};

export type MessageEventData = Readonly<
  {
    actionType?: string;
    commandId?: string;
    announce?: boolean;
    message?: string;
    narration?: MessageEventNarration;
  } & Record<string, unknown>
>;

export type MessageViewEvent = Readonly<
  {
    id: string;
    type: string;
    actorId: number | null;
    data: MessageEventData;
    sequence?: number;
    occurredAtMs?: number;
  } & Record<string, unknown>
>;

export type MessageSystemView = {
  match: { status: unknown };
  players: {
    all: Array<{ id: number; username: string } & Record<string, unknown>>;
  };
  events: {
    recent: MessageViewEvent[];
    latestByType: Record<string, MessageViewEvent>;
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
      recent: decodeEvents(events.recent),
      latestByType: Object.fromEntries(
        Object.entries(asUnknownRecord(events.latestByType)).flatMap(
          ([type, value]) => {
            const event = decodeEvent(value);
            return event ? [[type, event]] : [];
          },
        ),
      ),
    },
  };
}

function decodeEvents(value: unknown): MessageViewEvent[] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const event = decodeEvent(item);
    return event ? [event] : [];
  });
}

function decodeEvent(value: unknown): MessageViewEvent | null {
  const event = asUnknownRecord(value);
  if (typeof event.type !== 'string') return null;
  const actorId =
    typeof event.actorId === 'number' && Number.isSafeInteger(event.actorId)
      ? event.actorId
      : null;
  return {
    ...event,
    id: typeof event.id === 'string' ? event.id : '',
    type: event.type,
    actorId,
    data: asUnknownRecord(event.data),
    ...(typeof event.sequence === 'number' ? { sequence: event.sequence } : {}),
    ...(typeof event.occurredAtMs === 'number'
      ? { occurredAtMs: event.occurredAtMs }
      : {}),
  };
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
