import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mnemoContentRuntime } from './mnemo-content-runtime';
import { compileJsonGame } from '../rules/public-api';
import { DeclarativeGameRuntime } from '../engine/runtime/declarative-game.runtime';
import { createTestGameState } from '../core/testing/game-test-state';
import { GameExecutionScopeService } from '../core/application/services/game-execution-scope.service';
import { FixedGameClock } from '../core/application/models/game-execution-context.model';
import { MnemoQuizStoreService } from '../../modules/admin/infrastructure/storage/mnemo-quiz-store.service';
import type { GameRuntime } from '../core/application/ports/game-runtime.port';
import type { GameState } from '../core/application/models/game-state.model';
import manifest from '../games/vents-infinis/arche-de-mnemosyne/manifest.json';
import document from '../games/vents-infinis/arche-de-mnemosyne/game.json';
import seed from '../games/vents-infinis/arche-de-mnemosyne/quiz.json';
import { assertGameStateSize } from '../core/application/services/game-timeline';
import { GameRegistryService } from '../core/application/services/game-registry.service';
import { withCatalogWriteLock } from '../../modules/admin/infrastructure/storage/mnemo-catalog-lock';
import { archivedContent } from '../engine/infrastructure/content/archived-content';

const definition = compileJsonGame(manifest, document, {
  'content/quiz.json': seed,
});
const scope = new GameExecutionScopeService();
const fallback = new DeclarativeGameRuntime(definition);
const clock = new FixedGameClock(1700000000000);
let directory: string;
let previousPath: string | undefined;
let store: MnemoQuizStoreService;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mnemo-catalog-test-'));
  previousPath = process.env.MNEMO_QUIZ_PATH;
  process.env.MNEMO_QUIZ_PATH = join(directory, 'quiz.json');
  writeFileSync(
    process.env.MNEMO_QUIZ_PATH,
    JSON.stringify({
      categories: [{ id: 'test', name: 'Test' }],
      questions: [
        {
          ...seed.questions[0],
          id: 'q',
          categoryId: 'test',
          question: 'Original question',
          correct: 'Original answer',
          wrong1: 'B',
          wrong2: 'C',
          wrong3: 'D',
          status: 'validated',
        },
      ],
    }),
  );
  store = new MnemoQuizStoreService(
    { now: () => 1700000000000 },
    { filePath: process.env.MNEMO_QUIZ_PATH, seed },
  );
  store.onModuleInit();
});
afterEach(() => {
  if (previousPath === undefined) delete process.env.MNEMO_QUIZ_PATH;
  else process.env.MNEMO_QUIZ_PATH = previousPath;
  rmSync(directory, { recursive: true, force: true });
});

function start(runtime: GameRuntime) {
  const base = createTestGameState({
    definition,
    players: ['one', 'two'],
    seed: 127,
    startedAt: clock.nowIso(),
  });
  let state = runtime.hydrateInitialState(base, scope.create(base, 1, clock));
  state = act(runtime, state, 'game.configure', {
    ...document.simultaneousQuiz.defaults,
    useTimer: false,
  });
  return act(runtime, state, 'draw');
}
function act(
  runtime: GameRuntime,
  state: GameState,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return runtime.applyActions(
    state,
    [{ type, payload, meta: { actorId: 1 } }],
    scope.create(state, 1, clock),
  );
}
function view(runtime: GameRuntime, state: GameState) {
  return runtime.exposeStateForUser(state, 1, scope.create(state, 1, clock));
}

it('uses administrative edits for new games while restoring the original content of existing games', () => {
  const runtime = mnemoContentRuntime(fallback);
  const old = start(runtime);
  store.updateQuestion('q', {
    question: 'Edited question',
    correct: 'Edited answer',
  });
  const next = start(runtime);
  const sessionId = 'choice-simultaneous-quiz.current';
  expect(view(runtime, next)).toMatchObject({
    kits: {
      quiz: {
        sessions: {
          [sessionId]: {
            question: {
              prompt: 'Edited question',
              choices: expect.arrayContaining(['Edited answer']),
            },
          },
        },
      },
    },
  });
  const restored = JSON.parse(JSON.stringify(old)) as GameState;
  const freshRuntime = mnemoContentRuntime(fallback);
  const originalView = view(freshRuntime, restored);
  expect(originalView).toMatchObject({
    kits: {
      quiz: {
        sessions: {
          [sessionId]: {
            question: {
              prompt: 'Original question',
              choices: expect.arrayContaining(['Original answer']),
            },
          },
        },
      },
    },
  });
  expect(JSON.stringify(originalView)).not.toMatch(
    /contentSnapshot|choiceOrder|correctAnswerIndex/,
  );
  expect(originalView).not.toHaveProperty('contentVersion');
  expect(
    act(freshRuntime, restored, 'answer', { answerIndex: 0 }),
  ).toHaveProperty('contentVersion');
});

it('keeps descriptors and pinned sessions readable after the last question is trashed', () => {
  const runtime = mnemoContentRuntime(fallback);
  const current = start(runtime);
  store.updateQuestion('q', { status: 'trash' });
  const registry = new GameRegistryService({
    listEntries: () => [],
    readTextFile: () => '',
  });
  registry.register(runtime);
  expect(() => registry.listDescriptors()).not.toThrow();
  const restored = mnemoContentRuntime(fallback);
  expect(JSON.stringify(view(restored, current))).toContain(
    'Original question',
  );
  expect(() =>
    act(restored, current, 'answer', { answerIndex: 0 }),
  ).not.toThrow();
  expect(() => start(runtime)).toThrow();
});

it('stores a small reference even when the catalog is larger than the state limit', () => {
  const snapshot = store.getSnapshot();
  snapshot.questions = Array.from({ length: 650 }, (_, index) => ({
    ...snapshot.questions[0],
    id: `large-${index}`,
    question: 'Q'.repeat(1600),
  }));
  const filePath = join(directory, 'quiz.json');
  writeFileSync(filePath, JSON.stringify(snapshot));
  expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeGreaterThan(
    1_000_000,
  );
  const state = start(mnemoContentRuntime(fallback));
  expect(() => assertGameStateSize(state, 1_000_000)).not.toThrow();
  expect(state).not.toHaveProperty('contentSnapshot');
  expect(JSON.stringify(view(mnemoContentRuntime(fallback), state))).toContain(
    'Q'.repeat(1600),
  );
});

it('merges edits from independent stores and rolls back invalid patches', () => {
  const other = new MnemoQuizStoreService(
    { now: () => 1700000000000 },
    { filePath: join(directory, 'quiz.json'), seed },
  );
  other.onModuleInit();
  store.updateQuestion('q', { question: 'Edited by A' });
  other.renameCategory('test', 'Renamed by B');
  expect(store.getSnapshot()).toMatchObject({
    categories: [{ name: 'Renamed by B' }],
    questions: [{ question: 'Edited by A' }],
  });
  expect(() =>
    other.updateQuestion('q', { question: 'Partial edit', correct: '' }),
  ).toThrow();
  other.renameCategory('test', 'After failed edit');
  expect(store.getSnapshot().questions[0].question).toBe('Edited by A');
});

it('rejects competing writers and releases the lock after failures', () => {
  const filePath = join(directory, 'quiz.json');
  withCatalogWriteLock(filePath, () => {
    expect(() => store.renameCategory('test', 'Lost edit')).toThrow(
      'Catalogue en cours',
    );
  });
  expect(() => store.updateQuestion('q', { correct: '' })).toThrow();
  expect(() => store.renameCategory('test', 'Accepted edit')).not.toThrow();
});

it('reads legacy embedded content and migrates it on the next action', () => {
  const runtime = mnemoContentRuntime(fallback);
  const legacy: GameState & {
    contentVersion?: string;
    contentSnapshot?: object;
  } = start(runtime);
  if (!legacy.contentVersion) throw new Error('Missing archive version');
  legacy.contentSnapshot = archivedContent(
    `${join(directory, 'quiz.json')}.versions`,
  ).load(legacy.contentVersion);
  delete legacy.contentVersion;
  store.updateQuestion('q', { question: 'Changed after legacy save' });
  const restored = mnemoContentRuntime(fallback);
  expect(JSON.stringify(view(restored, legacy))).toContain('Original question');
  const migrated = act(restored, legacy, 'answer', { answerIndex: 0 });
  expect(migrated).toHaveProperty('contentVersion');
  expect(migrated).not.toHaveProperty('contentSnapshot');
  expect(
    JSON.stringify(view(mnemoContentRuntime(fallback), migrated)),
  ).toContain('Original question');
});

it('includes newly validated categories and excludes questions moved to trash', () => {
  const runtime = mnemoContentRuntime(fallback);
  const category = store.createCategory('New category');
  store.createQuestion({
    categoryId: category.id,
    question: 'New question',
    correct: 'Yes',
    wrong1: 'No',
    wrong2: 'Maybe',
    wrong3: 'Never',
    status: 'validated',
  });
  store.updateQuestion('q', { status: 'trash' });
  expect(runtime.getDescriptor().configuration?.input).toMatchObject({
    properties: { categoryId: { values: ['all', category.id] } },
  });
  expect(JSON.stringify(view(runtime, start(runtime)))).toContain(
    'New question',
  );
  expect(JSON.stringify(view(runtime, start(runtime)))).not.toContain(
    'Original question',
  );
});
