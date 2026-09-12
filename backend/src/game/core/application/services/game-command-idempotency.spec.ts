import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameState } from '../models/game-state.model';
import { GameCommandExecutorService } from './game-command-executor.service';
import { GameExecutionScopeService } from './game-execution-scope.service';
import { commandReceipt } from '../../../engine/runtime/actions/game-command-journal';

function fixture() {
  const apply = jest.fn((state: GameState) => state);
  const unused = (): never => {
    throw new Error('Unexpected runtime query');
  };
  const handler: GameRuntime = {
    gameType: 'test',
    category: 'test',
    displayName: 'Test',
    minPlayers: 1,
    maxPlayers: 2,
    hydrateInitialState: unused,
    getAvailableActions: unused,
    getActionCandidates: unused,
    exposeStateForUser: unused,
    getBotActions: unused,
    getAutomaticActions: unused,
    getShortcuts: unused,
    getDescriptor: unused,
    validateActor: () => true,
    validateAction: (_state: GameState, action: GameSingleActionDto) => action,
    applyActions: apply,
  };
  const executor = new GameCommandExecutorService(
    new GameExecutionScopeService(),
  );
  const initial: GameState = {
    status: 'started',
    phase: 'playing',
    log: [],
    version: 1,
    metadata: { rng: { seed: 42, counter: 0 } },
  };
  const action: GameSingleActionDto = {
    type: 'play',
    payload: { card: 'secret-card', target: 2 },
    meta: { commandId: 'command-123', knownVersion: 1 },
  };
  const run = (state: GameState, candidate = action, actorId = 1) =>
    executor.execute({ handler, state, actions: [candidate], actorId });
  return { apply, initial, action, run };
}

it('replays an identical command after JSON restoration without another mutation', () => {
  const { initial, action, run, apply } = fixture();
  const committed = run(initial);
  const restored = JSON.parse(JSON.stringify(committed)) as GameState;
  const result = run(restored, {
    ...action,
    payload: { target: 2, card: 'secret-card' },
    meta: { ...action.meta, knownVersion: 99, actorId: 999 },
  });
  expect(result).toEqual(restored);
  expect(apply).toHaveBeenCalledTimes(1);
  const receipt = commandReceipt(result, 'command-123');
  expect(receipt).toHaveProperty(
    'requestFingerprint',
    expect.stringMatching(/^v1:[a-f0-9]{64}$/),
  );
  expect(JSON.stringify(receipt)).not.toContain('secret-card');
});

it.each(['payload', 'action', 'actor', 'scheduler'])(
  'rejects reuse of a command ID with a different %s without mutation',
  (change) => {
    const { initial, action, run, apply } = fixture();
    const committed = run(initial);
    const before = structuredClone(committed);
    const candidate = structuredClone(action);
    if (change === 'payload')
      candidate.payload = { card: 'another-card', target: 2 };
    if (change === 'action') candidate.type = 'discard';
    if (change === 'scheduler')
      candidate.meta = { ...candidate.meta, schedulerId: 'different-timer' };
    expect(() =>
      run(committed, candidate, change === 'actor' ? 2 : 1),
    ).toThrow();
    expect(committed).toEqual(before);
    expect(apply).toHaveBeenCalledTimes(1);
  },
);

it('refuses replay of a legacy receipt whose payload cannot be verified', () => {
  const { initial, run, apply } = fixture();
  const committed = run(initial);
  const receipt = commandReceipt(committed, 'command-123');
  if (!receipt) throw new Error('Missing receipt');
  Reflect.deleteProperty(receipt, 'requestFingerprint');
  expect(() => run(committed)).toThrow();
  expect(apply).toHaveBeenCalledTimes(1);
});

it('preserves array order when detecting a changed payload', () => {
  const { initial, action, run } = fixture();
  const command = {
    ...action,
    payload: { cards: ['a', 'b'], nested: { x: 1, y: 2 } },
  };
  const committed = run(initial, command);
  expect(
    run(committed, {
      ...command,
      payload: { nested: { y: 2, x: 1 }, cards: ['a', 'b'] },
    }),
  ).toEqual(committed);
  expect(() =>
    run(committed, {
      ...command,
      payload: { ...command.payload, cards: ['b', 'a'] },
    }),
  ).toThrow();
});

it('does not execute payload accessors while computing the command identity', () => {
  const { initial, action, run, apply } = fixture();
  const get = jest.fn(() => 'secret');
  const payload: Record<string, unknown> = {};
  Object.defineProperty(payload, 'card', { enumerable: true, get });
  expect(() => run(initial, { ...action, payload })).toThrow();
  expect(get).not.toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
});
