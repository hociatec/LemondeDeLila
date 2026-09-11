import {
  migrateEngineSnapshot,
  type EngineSnapshot,
  type EngineSnapshotMigration,
} from './engine-snapshot-migrations';

function source(): EngineSnapshot {
  return {
    status: 'started',
    phase: 'playing',
    log: [],
    engine: {
      algorithmVersion: '1',
      schemaVersion: 1,
      contentVersion: 'cards-1',
      rulesVersion: 'rules-1',
      pending: ['old-task'],
    },
  };
}

it('transforms a complete migration chain on a clone without rewriting content identity', () => {
  const original = source();
  const before = structuredClone(original);
  const migrations: EngineSnapshotMigration[] = [
    {
      from: '1',
      to: '2',
      transform: (snapshot) => {
        snapshot.engine.tasks = snapshot.engine.pending;
        delete snapshot.engine.pending;
      },
    },
    {
      from: '2',
      to: '3',
      transform: (snapshot) => {
        snapshot.engine.scheduler = { tasks: snapshot.engine.tasks };
        delete snapshot.engine.tasks;
      },
    },
  ];
  expect(migrateEngineSnapshot(original, '3', migrations)).toMatchObject({
    engine: {
      algorithmVersion: '3',
      scheduler: { tasks: ['old-task'] },
      contentVersion: 'cards-1',
      rulesVersion: 'rules-1',
    },
  });
  expect(original).toEqual(before);
});

it('never interprets an absent legacy version as the current future engine', () => {
  const original = source();
  delete original.engine.algorithmVersion;
  expect(migrateEngineSnapshot(original, '1').engine.algorithmVersion).toBe(
    '1',
  );
  expect(() => migrateEngineSnapshot(original, '2')).toThrow(
    /migration absente/,
  );
});

it('rejects missing paths before executing any transformation', () => {
  const transform = jest.fn();
  expect(() =>
    migrateEngineSnapshot(source(), '3', [{ from: '1', to: '2', transform }]),
  ).toThrow();
  expect(transform).not.toHaveBeenCalled();
});

it('forbids an engine migration from replacing the saved content fingerprint', () => {
  const original = source();
  original.engine.contentDigest = 'original';
  expect(() =>
    migrateEngineSnapshot(original, '2', [
      {
        from: '1',
        to: '2',
        transform: (state) => {
          state.engine.contentDigest = 'replacement';
        },
      },
    ]),
  ).toThrow('versions');
  expect(original.engine.contentDigest).toBe('original');
});

it.each(
  [
    [
      { from: '1', to: '2', transform: () => {} },
      { from: '2', to: '1', transform: () => {} },
    ],
    [
      { from: '1', to: '2', transform: () => {} },
      { from: '1', to: '3', transform: () => {} },
    ],
    [
      {
        from: '1',
        to: '3',
        transform: (snapshot: EngineSnapshot) => {
          snapshot.engine.contentVersion = 'other';
        },
      },
    ],
    [
      {
        from: '1',
        to: '3',
        transform: (snapshot: EngineSnapshot) => {
          snapshot.engine.bad = () => {};
        },
      },
    ],
    [
      {
        from: '1',
        to: '3',
        transform: (snapshot: EngineSnapshot) => {
          snapshot.engine.pending = [];
          throw new Error('failure');
        },
      },
    ],
  ].map((migrations) => ({ migrations })),
)('fails atomically on invalid migrations', ({ migrations }) => {
  const original = source();
  const before = structuredClone(original);
  expect(() => migrateEngineSnapshot(original, '3', migrations)).toThrow();
  expect(original).toEqual(before);
});
