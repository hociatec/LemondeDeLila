import {
  baseRoomPayload,
  createGatewayFixture,
} from './tests/room.gateway.fixture';

describe('RoomGateway state lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('start room: updates cached payload on success path', async () => {
    const { gateway, deps } = createGatewayFixture();
    await gateway.handleRoomStart(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.startRoom).toHaveBeenCalledWith(10, 1, false);
    expect(gateway.broadcast).toHaveBeenCalledWith(10, 'state-updated', {
      roomId: 10,
    });
    expect(gateway.tryUpdateRoomPayload).toHaveBeenCalled();
    expect(gateway.sendRoomState).not.toHaveBeenCalled();
  });

  it('start room: falls back to invalidate+send state when cache update misses', async () => {
    const { gateway, deps } = createGatewayFixture();
    gateway.tryUpdateRoomPayload.mockResolvedValueOnce(false);

    await gateway.handleRoomStart(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.invalidateRoomPayloadCache).toHaveBeenCalledWith(
      10,
    );
    expect(gateway.sendRoomState).toHaveBeenCalledWith(10);
  });

  it('toggle privacy: broadcasts privacy state and announcement', async () => {
    const { gateway, deps } = createGatewayFixture();
    deps.roomsService.updateRoomPayloadCache.mockResolvedValueOnce(
      baseRoomPayload({ room: { isPrivate: true } }),
    );

    await gateway.handleTogglePrivacy(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.togglePrivacy).toHaveBeenCalledWith(10, 1, false);
    expect(gateway.broadcast).toHaveBeenCalledWith(
      10,
      'room.privacy',
      expect.objectContaining({ isPrivate: true }),
    );
    expect(gateway.broadcastRoomIntent).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        type: 'announcement',
        payload: { message: 'Table privée.' },
      }),
    );
  });
});

it('toggle privacy: falls back to getRoomPayload when cache update misses', async () => {
  const { gateway, deps } = createGatewayFixture();
  deps.roomsService.updateRoomPayloadCache.mockResolvedValueOnce(null);
  deps.roomsService.getRoomPayload.mockResolvedValueOnce(
    baseRoomPayload({ room: { isPrivate: false } }),
  );

  await gateway.handleTogglePrivacy(
    { roomId: 10, userId: 1 } as any,
    {},
    Date.now(),
  );

  expect(deps.roomsService.invalidateRoomPayloadCache).toHaveBeenCalledWith(10);
  expect(deps.roomsService.getRoomPayload).toHaveBeenCalledWith(10);
  expect(gateway.broadcast).toHaveBeenCalledWith(
    10,
    'room.privacy',
    expect.objectContaining({ isPrivate: false }),
  );
});
