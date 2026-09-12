import type { GameRuntime } from '../../../application/ports/game-runtime.port';
import type { GameState } from '../../../application/models/game-state.model';
import { GameWsHandler } from './game-ws.handler';

it('rebuilds an authorized full snapshot after a missed game version', async () => {
  const state: GameState = {
    status: 'started',
    phase: 'playing',
    version: 9,
    metadata: { roomRunId: 3 },
    log: [],
  };
  const resolved = {
    gameType: 'lama',
    state,
    handler: {} as GameRuntime,
  };
  const calls: string[] = [];
  const realtime = {
    resolve: jest.fn(async () => {
      calls.push('resolve');
      return resolved;
    }),
    bind: jest.fn(),
    schedule: jest.fn(),
    present: jest.fn(() => ({ roomId: 4, runId: 3, version: 9 })),
  };
  const rooms = {
    ensureReadable: jest.fn(async () => {
      calls.push('authorize');
    }),
  };
  const handler = new GameWsHandler(
    {} as ConstructorParameters<typeof GameWsHandler>[0],
    {} as ConstructorParameters<typeof GameWsHandler>[1],
    {} as ConstructorParameters<typeof GameWsHandler>[2],
    {
      resolveRoomId: jest.fn().mockReturnValue(4),
    } as unknown as ConstructorParameters<typeof GameWsHandler>[3],
    realtime as unknown as ConstructorParameters<typeof GameWsHandler>[4],
    rooms as unknown as ConstructorParameters<typeof GameWsHandler>[5],
    {} as ConstructorParameters<typeof GameWsHandler>[6],
    {} as ConstructorParameters<typeof GameWsHandler>[7],
  );

  await expect(
    handler.state({ user: { id: 7 }, connectionId: 'client-7' }, {}),
  ).resolves.toEqual({
    type: 'game.state',
    payload: { roomId: 4, runId: 3, version: 9 },
  });
  expect(calls).toEqual(['authorize', 'resolve']);
  expect(realtime.bind).toHaveBeenCalled();
  expect(realtime.schedule).toHaveBeenCalledWith(4, resolved);
});
