import type { WebSocket } from 'ws';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import { RoomGatewayRuntimeStateService } from './room-gateway-runtime-state.service';
import { RoomGatewayStateService } from './room-gateway-state.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function payload(name: string): RoomPayload {
  return {
    manifest: null,
    room: {
      id: 4,
      name,
      isPrivate: false,
      maxPlayers: 4,
      status: 'setup',
      gameType: 'lama',
      startedAt: null,
      runId: 0,
      tableAmbienceSoundId: null,
      counts: { players: 0, spectators: 0 },
      owner: null,
      players: [],
      spectators: [],
      bots: [],
    },
    generatedAt: '2026-09-11T00:00:00.000Z',
  };
}

function context() {
  let sequence = 0;
  return {
    clients: new Map(),
    rooms: new Map(),
    silentRooms: new Map(),
    lastRoomStatusByRoomId: new Map<number, string>(),
    lastRoomSnapshotByRoomId: new Map(),
    safeSend: jest.fn(),
    broadcast: jest.fn().mockResolvedValue(undefined),
    sendError: jest.fn().mockResolvedValue(undefined),
    promoteConnectedSpectatorsToParticipantsForRoom: jest
      .fn()
      .mockResolvedValue(undefined),
    nextRoomRealtimeVersion: () => ({
      streamId: 'process-a',
      sequence: ++sequence,
      snapshot: true as const,
    }),
    currentRoomRealtimeVersion: () => ({
      streamId: 'process-a',
      sequence,
      snapshot: true as const,
    }),
  };
}

it('serializes room reads and emits monotone snapshot sequences', async () => {
  const first = deferred<RoomPayload>();
  const getRoomPayload = jest
    .fn<Promise<RoomPayload>, [number]>()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(payload('second'));
  const broadcast = jest.fn().mockResolvedValue(undefined);
  const service = new RoomGatewayStateService(
    { getRoomPayload } as unknown as ConstructorParameters<
      typeof RoomGatewayStateService
    >[0],
    {} as ConstructorParameters<typeof RoomGatewayStateService>[1],
    new RoomGatewayStatePresenter(),
    { broadcast } as unknown as ConstructorParameters<
      typeof RoomGatewayStateService
    >[3],
  );
  const ctx = context();

  const one = service.sendRoomState(ctx, 4);
  const two = service.sendRoomState(ctx, 4);
  await Promise.resolve();
  expect(getRoomPayload).toHaveBeenCalledTimes(1);

  first.resolve(payload('first'));
  await Promise.all([one, two]);

  expect(getRoomPayload).toHaveBeenCalledTimes(2);
  expect(broadcast.mock.calls.map((call) => call[3])).toEqual([
    { streamId: 'process-a', sequence: 1, snapshot: true },
    { streamId: 'process-a', sequence: 2, snapshot: true },
  ]);
});

it('returns an authorized point-in-time snapshot at the current sequence', async () => {
  const service = new RoomGatewayStateService(
    {
      getRoomPayload: jest.fn().mockResolvedValue(payload('current')),
    } as unknown as ConstructorParameters<typeof RoomGatewayStateService>[0],
    {
      listAllowedActions: jest.fn().mockReturnValue([]),
    } as unknown as ConstructorParameters<typeof RoomGatewayStateService>[1],
    new RoomGatewayStatePresenter(),
    {} as ConstructorParameters<typeof RoomGatewayStateService>[3],
  );
  const ctx = context();
  ctx.nextRoomRealtimeVersion();
  ctx.nextRoomRealtimeVersion();
  const client = {} as WebSocket;
  ctx.clients.set(client, { userId: 12 });

  await service.sendRoomStateToClient(ctx, client, 4);

  expect(ctx.safeSend).toHaveBeenCalledWith(
    client,
    expect.objectContaining({
      type: 'room.updated',
      realtime: { streamId: 'process-a', sequence: 2, snapshot: true },
    }),
  );
});

it('changes stream identity after a process restart and restarts its sequence', () => {
  const first = new RoomGatewayRuntimeStateService(
    new RoomGatewayStatePresenter(),
  );
  const second = new RoomGatewayRuntimeStateService(
    new RoomGatewayStatePresenter(),
  );

  expect(first.nextRoomRealtimeVersion(4).sequence).toBe(1);
  expect(first.nextRoomRealtimeVersion(4).sequence).toBe(2);
  const restarted = second.nextRoomRealtimeVersion(4);
  expect(restarted.sequence).toBe(1);
  expect(restarted.streamId).not.toBe(
    first.currentRoomRealtimeVersion(4).streamId,
  );
});
