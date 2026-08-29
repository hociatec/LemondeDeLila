type TestGameState<TGame extends object> = {
  version?: number;
  status: string;
  phase: string;
  log: Array<{ key?: string; params?: Record<string, unknown> }>;
  players?: Array<{ id: number; username: string; roles?: string[] }>;
  game?: TGame;
};

export function buildTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 1,
    username: 'owner',
    roles: [],
    ...overrides,
  };
}

export function buildTestRoom(overrides: Partial<TestRoom> = {}): TestRoom {
  return {
    id: 10,
    name: 'Table test',
    isPrivate: false,
    maxPlayers: 6,
    status: 'setup',
    gameType: 'lama',
    startedAt: null,
    runId: null,
    ...overrides,
  };
}

export function buildTestRoomPayload(
  overrides: Omit<Partial<TestRoomPayload>, 'room'> & {
    room?: Partial<TestRoomView>;
  } = {},
): TestRoomPayload {
  const owner = buildTestUser();
  const room = buildTestRoom();
  const { room: roomOverrides, ...payloadOverrides } = overrides;
  return {
    manifest: {
      id: 'lama',
      name: 'Lama',
      minPlayers: 2,
      maxPlayers: 6,
      chatEnabled: true,
      chatSoundsEnabled: true,
    },
    room: {
      ...room,
      counts: { players: 1, spectators: 0 },
      owner: { id: owner.id, username: owner.username },
      players: [{ id: owner.id, username: owner.username }],
      spectators: [],
      bots: [],
      tableAmbienceSoundId: null,
      ...(roomOverrides ?? {}),
    },
    generatedAt: new Date(0).toISOString(),
    ...payloadOverrides,
  };
}

export function buildTestGameState<TGame extends object = object>(
  overrides: Partial<TestGameState<TGame>> = {},
): TestGameState<TGame> {
  return {
    version: 1,
    status: 'started',
    phase: 'playing',
    log: [],
    players: [buildTestUser()],
    ...overrides,
  };
}

export function buildTestGameSession<TGame extends object = object>(
  overrides: Partial<TestGameSession<TGame>> = {},
): TestGameSession<TGame> {
  return {
    roomId: 10,
    gameType: 'lama',
    version: 1,
    state: buildTestGameState<TGame>(),
    updatedAt: new Date(0),
    ...overrides,
  };
}

export function buildTestSocket() {
  return {
    readyState: 1,
    send: jest.fn((_message: unknown, callback?: () => void) => callback?.()),
    close: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

export type TestUser = {
  id: number;
  username: string;
  roles: string[];
};

export type TestRoom = {
  id: number;
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
  status: string;
  gameType: string;
  startedAt: Date | null;
  runId: number | null;
};

type TestRoomView = TestRoom & {
  counts: { players: number; spectators: number };
  owner: { id: number; username: string };
  players: Array<{ id: number; username: string }>;
  spectators: Array<{ id: number; username: string }>;
  bots: Array<{ id: number; username: string }>;
  tableAmbienceSoundId: string | null;
};

type TestRoomPayload = {
  manifest: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
    chatEnabled: boolean;
    chatSoundsEnabled: boolean;
  };
  room: TestRoomView;
  generatedAt: string;
};

type TestGameSession<TGame extends object> = {
  roomId: number;
  gameType: string;
  version: number;
  state: TestGameState<TGame>;
  updatedAt: Date;
};
