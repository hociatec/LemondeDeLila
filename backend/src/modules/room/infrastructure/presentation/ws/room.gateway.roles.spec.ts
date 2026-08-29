import {
  baseRoomPayload,
  createGatewayFixture,
  createSocket,
} from './tests/room.gateway.fixture';

describe('RoomGateway role lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('set role: rejects role change when game already started', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 10,
      role: 'participant',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: { status: 'started', startedAt: '2026-03-02T12:00:00.000Z' },
      }),
    );

    await expect(gateway.handleSetRole(socket, meta, {})).rejects.toThrow(
      'Partie déjà commencée',
    );
  });

  it('set role: toggles participant -> spectator in public room', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 10,
      role: 'participant',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          isPrivate: false,
          status: 'setup',
          owner: { id: 1, username: 'owner' },
        },
      }),
    );

    await gateway.handleSetRole(socket, meta, {});

    expect(deps.roomsService.leaveRoom).toHaveBeenCalledWith(
      10,
      1,
      expect.objectContaining({ preserveRoom: true, preserveOwner: true }),
    );
    expect(meta.role).toBe('spectator');
    expect(gateway.sendRoomState).toHaveBeenCalledWith(10);

    const sent = socket.send.mock.calls.map((call: any[]) =>
      JSON.parse(String(call[0])),
    );
    expect(
      sent.some(
        (m: any) => m.type === 'room.role' && m.payload?.spectator === true,
      ),
    ).toBe(true);
  });

  it('set role: private room requires invitation for non-owner/non-participant', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 7,
      username: 'user',
      roomId: 10,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          isPrivate: true,
          status: 'setup',
          owner: { id: 1, username: 'owner' },
          players: [{ id: 1, username: 'owner' }],
        },
      }),
    );

    await expect(
      gateway.handleSetRole(socket, meta, { spectator: false }),
    ).rejects.toThrow('Table privée: invitation requise');
  });

  it('set role: private room allows owner to become participant', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 10,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          isPrivate: true,
          status: 'setup',
          owner: { id: 1, username: 'owner' },
        },
      }),
    );

    await gateway.handleSetRole(socket, meta, { spectator: false });

    expect(deps.roomsService.joinRoom).toHaveBeenCalledWith(10, 1, {
      allowPrivate: true,
    });
    expect(meta.role).toBe('participant');
  });
});
