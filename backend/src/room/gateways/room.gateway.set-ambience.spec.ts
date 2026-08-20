import { RoomGateway } from './room.gateway';
import { RoomGatewayActionsService } from './room-gateway-actions.service';
import { RoomGatewayCommandService } from './room-gateway-command.service';
import { RoomGatewayConnectionService } from './room-gateway-connection.service';
import { RoomGatewayLifecycleService } from './room-gateway-lifecycle.service';
import { RoomGatewayPresenceService } from './room-gateway-presence.service';
import { RoomGatewaySessionService } from './room-gateway-session.service';
import { RoomGatewayStateService } from './room-gateway-state.service';

function createGateway() {
  const roomsService: any = {
    setRealtimeNotifier: jest.fn(),
    setRoomDeletedNotifier: jest.fn(),
    requireRoomForOwnerAction: jest.fn().mockResolvedValue({ id: 10 }),
    saveRoom: jest.fn().mockResolvedValue(undefined),
    invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
  };
  const botService: any = {};
  const auth: any = {};
  const catalog: any = {};
  const perf: any = {
    measure: jest
      .fn()
      .mockImplementation(async (_name: string, fn: any) => fn()),
  };
  const invites: any = {};
  const clientUpdates: any = {};
  const wsTickets: any = {};
  const realtimeTracker: any = {};
  const sounds: any = {
    listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({
      items: [{ soundId: 'TableAmbience1', name: 'A1', enabled: true }],
    }),
  };
  const lifecycle = new RoomGatewayLifecycleService(
    roomsService,
    catalog,
    perf,
    realtimeTracker,
  ) as any;
  const actions = new RoomGatewayActionsService(
    roomsService,
    botService,
    perf,
    realtimeTracker,
  ) as any;
  const commands = new RoomGatewayCommandService() as any;
  const connection = new RoomGatewayConnectionService(
    roomsService,
    auth,
    clientUpdates,
    wsTickets,
  ) as any;
  const presence = new RoomGatewayPresenceService(roomsService) as any;
  const state = new RoomGatewayStateService(roomsService) as any;
  const session = new RoomGatewaySessionService(roomsService) as any;

  const gateway = new RoomGateway(
    roomsService,
    botService,
    catalog,
    perf,
    invites,
    realtimeTracker,
    sounds,
    actions,
    commands,
    connection,
    lifecycle,
    presence,
    state,
    session,
  ) as any;

  gateway.sendError = jest.fn().mockResolvedValue(undefined);
  gateway.tryUpdateRoomPayload = jest.fn().mockResolvedValue(true);
  gateway.sendRoomState = jest.fn().mockResolvedValue(undefined);

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
