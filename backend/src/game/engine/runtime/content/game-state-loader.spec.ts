import { loadDeclarativeState } from './game-state-loader';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import { assertSerializableState } from '../state/assert-serializable-state';
import { GAME_ENGINE_ALGORITHM_VERSION } from './engine-algorithm-version';

function snapshot() {
  return {
    status: 'started',
    phase: 'playing',
    log: [],
    game: {},
    engine: {
      algorithmVersion: GAME_ENGINE_ALGORITHM_VERSION as string,
      schemaVersion: 1,
      contentVersion: 'content-1',
      rulesVersion: 'rules-1',
      scheduler: { tasks: {} },
    },
  };
}
const load = (state: ReturnType<typeof snapshot>) =>
  loadDeclarativeState(state, 'test', 1, 'content-1', 'rules-1');

it('rejects missing or mismatched content fingerprints unless a different version has an explicit migration', () => {
  const source = snapshot();
  const before = structuredClone(source);
  expect(() =>
    loadDeclarativeState(
      source,
      'test',
      1,
      'content-1',
      'rules-1',
      [],
      'a'.repeat(64),
    ),
  ).toThrow('incompatible');
  const mismatched = {
    ...source,
    engine: { ...source.engine, contentDigest: 'b'.repeat(64) },
  };
  expect(() =>
    loadDeclarativeState(
      mismatched,
      'test',
      1,
      'content-1',
      'rules-1',
      [],
      'a'.repeat(64),
    ),
  ).toThrow('incompatible');
  const migrated = loadDeclarativeState(
    source,
    'test',
    1,
    'content-2',
    'rules-1',
    [{ fromVersion: 'content-1', toVersion: 'content-2' }],
    'a'.repeat(64),
  );
  expect(migrated.engine.contentDigest).toBe('a'.repeat(64));
  expect(source).toEqual(before);
});

it('records and enforces the deterministic engine algorithm version', () => {
  const current = load(snapshot());
  expect(current.engine.algorithmVersion).toBe(GAME_ENGINE_ALGORITHM_VERSION);
  const incompatible = snapshot();
  incompatible.engine.algorithmVersion = 'future-incompatible';
  expect(() => load(incompatible)).toThrow(
    'incompatible avec le runtime courant',
  );
});

it('migrates only the explicitly declared content version pair on a clone', () => {
  const source = snapshot();
  const before = structuredClone(source);
  const migrations = [{ fromVersion: 'content-1', toVersion: 'content-2' }];
  const restored = loadDeclarativeState(
    source,
    'test',
    1,
    'content-2',
    'rules-1',
    migrations,
  );
  expect(restored).toEqual({
    ...source,
    engine: {
      ...source.engine,
      algorithmVersion: GAME_ENGINE_ALGORITHM_VERSION,
      contentVersion: 'content-2',
    },
  });
  expect(source).toEqual(before);
  expect(() =>
    loadDeclarativeState(source, 'test', 1, 'content-3', 'rules-1', migrations),
  ).toThrow(GameStateViolationError);
  expect(() =>
    loadDeclarativeState(source, 'test', 2, 'content-2', 'rules-1', migrations),
  ).toThrow(GameStateViolationError);
  expect(() =>
    loadDeclarativeState(source, 'test', 1, 'content-2', 'rules-2', migrations),
  ).toThrow(GameStateViolationError);
});

it('resolves a bounded migration chain and rejects cycles without a target', () => {
  const source = snapshot();
  const migrations = [
    { fromVersion: 'content-1', toVersion: 'content-2' },
    { fromVersion: 'content-2', toVersion: 'content-3' },
    { fromVersion: 'content-3', toVersion: 'content-1' },
  ];
  expect(
    loadDeclarativeState(source, 'test', 1, 'content-3', 'rules-1', migrations)
      .engine.contentVersion,
  ).toBe('content-3');
  expect(() =>
    loadDeclarativeState(source, 'test', 1, 'content-4', 'rules-1', migrations),
  ).toThrow(GameStateViolationError);
});

it.each(['schemaVersion', 'contentVersion', 'rulesVersion'] as const)(
  'rejects a snapshot with incompatible %s without mutating it',
  (key) => {
    const source = snapshot();
    Object.assign(source.engine, { [key]: 'incompatible' });
    const before = structuredClone(source);
    expect(() => load(source)).toThrow(GameStateViolationError);
    expect(source).toEqual(before);
  },
);

it('reports missing engine metadata as a domain error', () => {
  expect(() =>
    loadDeclarativeState(
      { status: 'started', phase: 'playing', log: [] },
      'test',
      1,
      'content-1',
      'rules-1',
    ),
  ).toThrow(GameStateViolationError);
});

it('upgrades legacy task headers on the clone and preserves their action payloads', () => {
  const task = {
    id: 'turn',
    dueAtMs: 100,
    visibility: { kind: 'public' },
    action: { type: 'pass', payload: { player: 7 } },
  };
  const source = snapshot();
  source.engine.scheduler.tasks = { turn: task };
  const restored = load(source);
  expect(restored.engine.scheduler.tasks.turn).toEqual({
    ...task,
    schemaVersion: 1,
  });
  expect(source.engine.scheduler.tasks).toEqual({ turn: task });
  expect(restored).not.toBe(source);
});

it.each([() => {}, Symbol('bad'), 1n, NaN, Infinity, new Map(), new Set()])(
  'rejects non-persistable nested values before cloning: %p',
  (bad) => {
    const source = { ...snapshot(), game: { bad } };
    expect(() => load(source)).toThrow(GameStateViolationError);
  },
);

it('rejects cycles and accessors without executing them', () => {
  const cycle: { self?: object } = {};
  cycle.self = cycle;
  expect(() => assertSerializableState(cycle)).toThrow(GameStateViolationError);
  const getter = jest.fn(() => 'bad');
  const source = Object.defineProperty({}, 'hidden', {
    enumerable: true,
    get: getter,
  });
  expect(() => assertSerializableState(source)).toThrow(
    GameStateViolationError,
  );
  expect(getter).not.toHaveBeenCalled();
});
