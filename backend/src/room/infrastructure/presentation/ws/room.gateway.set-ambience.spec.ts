import { RoomGatewayActionsService } from './room-gateway-actions.service';
import { RoomAdminPolicyService } from '../../../application/services/room-admin-policy.service';
import { RoomGatewayPresenter } from './room-gateway.presenter';

function createGateway() {
  const roomsService: any = {
    requireRoomForOwnerAction: jest.fn().mockResolvedValue({ id: 10 }),
    saveRoom: jest.fn().mockResolvedValue(undefined),
    invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
  };
  const roomState: any = {
    getRoomPayload: jest.fn(),
    isBanned: jest.fn().mockReturnValue(false),
    invalidateRoomPayloadCache: roomsService.invalidateRoomPayloadCache,
    updateRoomPayloadCache: jest.fn().mockResolvedValue(null),
    notifyRoomStateUpdated: jest.fn().mockResolvedValue(undefined),
    primeRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
  };
  const perf: any = {
    measure: jest
      .fn()
      .mockImplementation(async (_name: string, fn: any) => fn()),
  };
  const realtimeTracker: any = {
    setSocketParticipantRoom: jest.fn(),
    clearSocket: jest.fn(),
  };
  const sounds: any = {
    listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({
      items: [{ soundId: 'TableAmbience1', name: 'A1', enabled: true }],
    }),
  };
  const adminPolicy = new RoomAdminPolicyService();
  const gatewayPresenter = new RoomGatewayPresenter();
  const actions = new RoomGatewayActionsService(
    roomsService,
    roomsService,
    roomState,
    adminPolicy,
    perf,
    realtimeTracker,
    gatewayPresenter,
  ) as any;
  const gateway: any = {
    sendError: jest.fn().mockResolvedValue(undefined),
    tryUpdateRoomPayload: jest.fn().mockResolvedValue(true),
    sendRoomState: jest.fn().mockResolvedValue(undefined),
  };
  const context = {
    server: {} as any,
    rooms: new Map(),
    silentRooms: new Map(),
    clients: new Map(),
    broadcast: jest.fn().mockResolvedValue(undefined),
    broadcastRoomIntent: jest.fn().mockResolvedValue(undefined),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    tryUpdateRoomPayload: (...args: any[]) =>
      gateway.tryUpdateRoomPayload(...args),
    sendError: (...args: any[]) => gateway.sendError(...args),
    safeSend: jest.fn(),
    sendRoomError: jest.fn(),
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    hasUserConnections: jest.fn().mockReturnValue(false),
    resetClientRoomState: jest.fn(),
    asRecord: (value: unknown) =>
      value != null && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {},
  };
  gateway.handleSetAmbience = (
    client: any,
    meta: any,
    payload: unknown,
    receivedAtMs: number,
  ) =>
    actions.handleSetAmbience(
      context,
      client,
      meta,
      payload,
      receivedAtMs,
      () => sounds.listTableAmbiencesWithFilter(),
    );

  return { gateway, roomsService, sounds };
}

describe('RoomGateway.handleSetAmbience', () => {
  it('accepts an active table ambience and persists it', async () => {
    const { gateway, roomsService, sounds } = createGateway();

    await gateway.handleSetAmbience(
      {} as any,
      { roomId: 10, userId: 1 } as any,
      { soundId: 'TableAmbience1' },
      Date.now(),
    );

    expect(sounds.listTableAmbiencesWithFilter).toHaveBeenCalled();
    expect(roomsService.requireRoomForOwnerAction).toHaveBeenCalledWith(10, 1);
    expect(roomsService.saveRoom).toHaveBeenCalled();
    const savedRoom = roomsService.saveRoom.mock.calls[0][0];
    expect(savedRoom.tableAmbienceSoundId).toBe('TableAmbience1');
    expect(gateway.sendError).not.toHaveBeenCalled();
  });

  it('rejects an inactive or missing ambience id', async () => {
    const { gateway, roomsService, sounds } = createGateway();
    sounds.listTableAmbiencesWithFilter.mockResolvedValue({ items: [] });

    await gateway.handleSetAmbience(
      {} as any,
      { roomId: 10, userId: 1 } as any,
      { soundId: 'TableAmbience1' },
      Date.now(),
    );

    expect(gateway.sendError).toHaveBeenCalledWith(
      expect.anything(),
      'Ambiance indisponible: TableAmbience1',
    );
    expect(roomsService.requireRoomForOwnerAction).not.toHaveBeenCalled();
    expect(roomsService.saveRoom).not.toHaveBeenCalled();
  });

  it('rejects an invalid ambience id before querying active list', async () => {
    const { gateway, roomsService, sounds } = createGateway();

    await gateway.handleSetAmbience(
      {} as any,
      { roomId: 10, userId: 1 } as any,
      { soundId: 'TableAmbience99' },
      Date.now(),
    );

    expect(gateway.sendError).toHaveBeenCalledWith(
      expect.anything(),
      'Ambiance invalide: TableAmbience99',
    );
    expect(sounds.listTableAmbiencesWithFilter).not.toHaveBeenCalled();
    expect(roomsService.saveRoom).not.toHaveBeenCalled();
  });

  it('allows clearing ambience with an empty sound id', async () => {
    const { gateway, roomsService, sounds } = createGateway();

    await gateway.handleSetAmbience(
      {} as any,
      { roomId: 10, userId: 1 } as any,
      { soundId: '' },
      Date.now(),
    );

    expect(sounds.listTableAmbiencesWithFilter).not.toHaveBeenCalled();
    expect(roomsService.requireRoomForOwnerAction).toHaveBeenCalledWith(10, 1);
    const savedRoom = roomsService.saveRoom.mock.calls[0][0];
    expect(savedRoom.tableAmbienceSoundId).toBeNull();
    expect(gateway.sendError).not.toHaveBeenCalled();
  });
});
