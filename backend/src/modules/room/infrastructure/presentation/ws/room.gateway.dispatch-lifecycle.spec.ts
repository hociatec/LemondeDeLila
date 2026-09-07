import {
  createGatewayFixture,
  createSocket,
} from './tests/room.gateway.fixture';

describe('RoomGateway disconnect and command dispatch lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delayed participant leave disables replacement bot after a disconnect grace timeout', () => {
    jest.useFakeTimers();
    try {
      const { gateway, deps } = createGatewayFixture();

      gateway.sendRoomState = jest.fn().mockResolvedValue(undefined);
      gateway.hasUserConnections = jest.fn().mockReturnValue(false);

      gateway.scheduleDelayedParticipantLeave(10, 3);
      jest.runOnlyPendingTimers();

      expect(deps.roomsService.leaveRoom).toHaveBeenCalledWith(
        10,
        3,
        expect.objectContaining({
          preserveRoom: false,
          disconnectOnly: false,
          replaceWithBot: false,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('immediate ack: emits room.ack only for immediate actions', () => {
    const { gateway } = createGatewayFixture();
    const socket = createSocket();
    const meta = { roomId: 10 };
    const sentAtMs = Date.now() - 50;
    const receivedAtMs = Date.now();

    gateway.sendImmediateAckIfNeeded(
      socket,
      meta,
      'room.start',
      { _trace: { id: 'trace-1', sentAtMs } },
      receivedAtMs,
    );
    gateway.sendImmediateAckIfNeeded(
      socket,
      meta,
      'room.chat.send',
      { _trace: { id: 'trace-2', sentAtMs } },
      receivedAtMs,
    );

    const sent = socket.send.mock.calls.map((call: any[]) =>
      JSON.parse(String(call[0])),
    );
    expect(sent.filter((m: any) => m.type === 'room.ack')).toHaveLength(1);
    expect(sent[0].payload.action).toBe('room.start');
    expect(sent[0].payload.traceId).toBe('trace-1');
  });

  it('routes canonical room.start and room.create intents', async () => {
    const { gateway } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      roomId: 10,
      userId: 1,
      username: 'owner',
      role: 'participant',
      silent: false,
      isAdmin: false,
    };

    const startSpy = jest
      .spyOn(gateway, 'handleRoomStart')
      .mockResolvedValue(undefined);
    const createSpy = jest
      .spyOn(gateway, 'handleRoomCreate')
      .mockResolvedValue(undefined);

    await gateway.executeRoomCommand(
      socket,
      meta,
      'room.start',
      { foo: 'bar' },
      Date.now(),
    );
    await gateway.executeRoomCommand(
      socket,
      meta,
      'room.create',
      { gameType: 'lama' },
      Date.now(),
    );

    expect(startSpy).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalled();
  });

  it('rejects obsolete intent aliases', async () => {
    const { gateway } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      roomId: 10,
      userId: 1,
      username: 'owner',
      role: 'participant',
      silent: false,
      isAdmin: false,
    };

    await expect(
      gateway.handleRoomIntentExecute(
        socket,
        meta,
        { intentId: 'room.toggle-role', data: { spectator: true } },
        Date.now(),
      ),
    ).rejects.toThrow('Intent inconnu: room.toggle-role');
  });
});
