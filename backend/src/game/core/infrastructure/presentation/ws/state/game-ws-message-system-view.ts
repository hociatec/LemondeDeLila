export type MessageEventNarration = {
  default?: string;
  byPlayerId?: Readonly<Record<string, string>>;
  supersedes?: readonly string[];
};

export type MessageScalar = string | number | boolean;

export type MessageCardView =
  | MessageScalar
  | {
      id?: MessageScalar;
      label?: MessageScalar;
      name?: MessageScalar;
      value?: MessageScalar;
    };

export type ReceivedCardEventData = {
  playerId?: number;
  card?: MessageCardView;
};

export type TurnStartedEventData = {
  playerId?: number;
  turnNumber?: number;
};

export type ScoreChangedEventData = {
  playerId?: number;
  value?: MessageScalar;
  delta?: number;
};

export type QuizResultView = {
  playerId?: number;
  outcome?: string;
};

/** Stable semantic fields consumed by the generic presenter after decoding. */
export type SemanticMessageParams = {
  playerId?: number;
  actorId?: number;
  targetId?: number;
  starterPlayerId?: number;
  total?: number;
  spaces?: number;
  x?: number;
  y?: number;
  cardLabel?: MessageScalar;
  cardId?: MessageScalar;
  correctAnswer?: string;
  effectDescription?: MessageScalar;
  round?: MessageScalar;
  automatic?: boolean;
  revealed?: boolean;
  results: readonly QuizResultView[];
};

export type SemanticMessageData = {
  announce?: boolean;
  message?: string;
  narration?: MessageEventNarration;
  key: string;
  params: SemanticMessageParams;
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
    data: decodeEventData(event.data),
    ...(typeof event.sequence === 'number' ? { sequence: event.sequence } : {}),
    ...(typeof event.occurredAtMs === 'number'
      ? { occurredAtMs: event.occurredAtMs }
      : {}),
  };
}

export function decodeReceivedCardData(
  value: MessageEventData | undefined,
): ReceivedCardEventData {
  const data = value ?? {};
  const playerId = safeInteger(data.playerId);
  const card = decodeCard(data.card);
  return {
    ...(playerId == null ? {} : { playerId }),
    ...(card === undefined ? {} : { card }),
  };
}

export function decodeTurnStartedData(value: unknown): TurnStartedEventData {
  const data = asUnknownRecord(value);
  const playerId = safeInteger(data.playerId);
  const turnNumber = safeInteger(data.turnNumber);
  return {
    ...(playerId == null ? {} : { playerId }),
    ...(turnNumber == null ? {} : { turnNumber }),
  };
}

export function decodeScoreChangedData(
  value: MessageEventData,
): ScoreChangedEventData {
  const playerId = safeInteger(value.playerId);
  const delta = safeInteger(value.delta);
  const score = decodeScalar(value.value);
  return {
    ...(playerId == null ? {} : { playerId }),
    ...(score === undefined ? {} : { value: score }),
    ...(delta == null ? {} : { delta }),
  };
}

export function decodeSemanticMessageData(
  value: MessageEventData,
): SemanticMessageData {
  const params = asUnknownRecord(value.params);
  const results = (Array.isArray(params.results) ? params.results : []).map(
    decodeQuizResult,
  );
  return {
    ...(value.announce === undefined ? {} : { announce: value.announce }),
    ...(value.message === undefined ? {} : { message: value.message }),
    ...(value.narration === undefined ? {} : { narration: value.narration }),
    key: typeof value.key === 'string' ? boundedString(value.key) : '',
    params: {
      ...integerFields(params),
      ...scalarFields(params),
      ...(typeof params.correctAnswer === 'string'
        ? { correctAnswer: boundedString(params.correctAnswer) }
        : {}),
      ...(typeof params.automatic === 'boolean'
        ? { automatic: params.automatic }
        : {}),
      ...(typeof params.revealed === 'boolean'
        ? { revealed: params.revealed }
        : {}),
      results,
    },
  };
}

function decodeEventData(value: unknown): MessageEventData {
  const data = asUnknownRecord(value);
  const narration = decodeNarration(data.narration);
  return {
    ...data,
    ...(typeof data.actionType === 'string'
      ? { actionType: boundedString(data.actionType) }
      : {}),
    ...(typeof data.commandId === 'string'
      ? { commandId: boundedString(data.commandId) }
      : {}),
    ...(typeof data.announce === 'boolean' ? { announce: data.announce } : {}),
    ...(typeof data.message === 'string'
      ? { message: boundedString(data.message) }
      : {}),
    ...(narration ? { narration } : {}),
  };
}

function decodeNarration(value: unknown): MessageEventNarration | undefined {
  const narration = asUnknownRecord(value);
  const byPlayerId = Object.fromEntries(
    Object.entries(asUnknownRecord(narration.byPlayerId)).flatMap(
      ([playerId, message]) =>
        typeof message === 'string'
          ? [[playerId, boundedString(message)] as const]
          : [],
    ),
  );
  const supersedes = (
    Array.isArray(narration.supersedes) ? narration.supersedes : []
  ).flatMap((type) => (typeof type === 'string' ? [boundedString(type)] : []));
  const defaultMessage =
    typeof narration.default === 'string'
      ? boundedString(narration.default)
      : undefined;
  if (
    !defaultMessage &&
    Object.keys(byPlayerId).length === 0 &&
    !supersedes.length
  )
    return undefined;
  return {
    ...(defaultMessage ? { default: defaultMessage } : {}),
    ...(Object.keys(byPlayerId).length > 0 ? { byPlayerId } : {}),
    ...(supersedes.length > 0 ? { supersedes } : {}),
  };
}

function integerFields(
  params: Record<string, unknown>,
): Pick<
  SemanticMessageParams,
  | 'playerId'
  | 'actorId'
  | 'targetId'
  | 'starterPlayerId'
  | 'total'
  | 'spaces'
  | 'x'
  | 'y'
> {
  return Object.fromEntries(
    [
      'playerId',
      'actorId',
      'targetId',
      'starterPlayerId',
      'total',
      'spaces',
      'x',
      'y',
    ].flatMap((key) => {
      const value = safeInteger(params[key]);
      return value == null ? [] : [[key, value]];
    }),
  );
}

function scalarFields(
  params: Record<string, unknown>,
): Pick<
  SemanticMessageParams,
  'cardLabel' | 'cardId' | 'effectDescription' | 'round'
> {
  return Object.fromEntries(
    ['cardLabel', 'cardId', 'effectDescription', 'round'].flatMap((key) => {
      const value = decodeScalar(params[key]);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

function decodeQuizResult(value: unknown): QuizResultView {
  const result = asUnknownRecord(value);
  const playerId = safeInteger(result.playerId);
  return {
    ...(playerId == null ? {} : { playerId }),
    ...(typeof result.outcome === 'string'
      ? { outcome: boundedString(result.outcome) }
      : {}),
  };
}

function decodeCard(value: unknown): MessageCardView | undefined {
  const scalar = decodeScalar(value);
  if (scalar !== undefined) return scalar;
  const card = asUnknownRecord(value);
  const decoded = Object.fromEntries(
    ['id', 'label', 'name', 'value'].flatMap((key) => {
      const field = decodeScalar(card[key]);
      return field === undefined ? [] : [[key, field]];
    }),
  ) as Exclude<MessageCardView, MessageScalar>;
  return Object.keys(decoded).length > 0 ? decoded : undefined;
}

function decodeScalar(value: unknown): MessageScalar | undefined {
  if (typeof value === 'string') return boundedString(value);
  return typeof value === 'number' || typeof value === 'boolean'
    ? value
    : undefined;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : undefined;
}

function boundedString(value: string): string {
  return value.trim().slice(0, 2_000);
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
