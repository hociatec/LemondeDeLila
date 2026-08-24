import { RoomGateway } from './room.gateway';
import { RoomGatewayActionsService } from './room-gateway-actions.service';
import { RoomGatewayCommandService } from './room-gateway-command.service';
import { RoomGatewayConnectionService } from './room-gateway-connection.service';
import { RoomGatewayLifecycleService } from './room-gateway-lifecycle.service';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
import { RoomGatewayPresenceService } from './room-gateway-presence.service';
import { RoomGatewaySessionService } from './room-gateway-session.service';
import { RoomGatewaySessionPresenter } from './room-gateway-session.presenter';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import { RoomGatewayStateService } from './room-gateway-state.service';
import { RoomClientPolicyService } from '../../../application/services/room-client-policy.service';
import { RoomJoinPolicyService } from '../../../application/services/room-join-policy.service';
import { RoomAdminPolicyService } from '../../../application/services/room-admin-policy.service';
import { RoomGatewayPresenter } from './room-gateway.presenter';

function createGateway() {
  const roomsService: any = {
    isBanned: jest.fn().mockReturnValue(false),
    getRoomPayload: jest.fn(),
  };
  const roomState: any = {
    isBanned: roomsService.isBanned,
    getRoomPayload: roomsService.getRoomPayload,
    invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
    updateRoomPayloadCache: jest.fn().mockResolvedValue(null),
    notifyRoomStateUpdated: jest.fn().mockResolvedValue(undefined),
    primeRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
  };
  const addBotToRoom: any = { execute: jest.fn() };
  const getLastRoomBot: any = { execute: jest.fn() };
  const removeBotFromRoom: any = { execute: jest.fn() };
  const auth: any = {};
  const catalog: any = {};
  const perf: any = {
    measure: jest
      .fn()
      .mockImplementation(async (_metric: string, fn: any) => await fn()),
  };
  const invites: any = {
    canSpectate: jest.fn().mockReturnValue(false),
  };
  const clientUpdates: any = {};
  const wsTickets: any = {};
  const realtimeTracker: any = {};
  const sounds: any = {
    listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({ items: [] }),
  };
  const joinPolicy = new RoomJoinPolicyService();
  const clientPolicy = new RoomClientPolicyService();
  const lifecyclePresenter = new RoomGatewayLifecyclePresenter();
  const sessionPresenter = new RoomGatewaySessionPresenter();
  const statePresenter = new RoomGatewayStatePresenter();
  const adminPolicy = new RoomAdminPolicyService();
  const gatewayPresenter = new RoomGatewayPresenter();
  const lifecycle = new RoomGatewayLifecycleService(
    roomsService,
    roomsService,
    roomState,
    catalog,
    perf,
    realtimeTracker,
    joinPolicy,
    lifecyclePresenter,
  ) as any;
  const actions = new RoomGatewayActionsService(
    roomsService,
    roomsService,
    roomState,
    adminPolicy,
    addBotToRoom,
    getLastRoomBot,
    removeBotFromRoom,
    perf,
    realtimeTracker,
    gatewayPresenter,
  ) as any;
  const commands = new RoomGatewayCommandService() as any;
  const connection = new RoomGatewayConnectionService(
    roomsService,
    roomState,
    auth,
    clientUpdates,
    wsTickets,
    joinPolicy,
    lifecyclePresenter,
  ) as any;
  const presence = new RoomGatewayPresenceService(
    roomsService,
    roomState,
  ) as any;
  const state = new RoomGatewayStateService(
    roomState,
    clientPolicy,
    statePresenter,
  ) as any;
  const session = new RoomGatewaySessionService(
    clientPolicy,
    roomState,
    sessionPresenter,
  ) as any;
  const roomEvents = {
    onRoomStateUpdated: jest.fn(),
    onRoomDeleted: jest.fn(),
  };

  const gateway = new RoomGateway(
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
    statePresenter,
    state,
    session,
    roomEvents,
  ) as any;

  return { gateway, roomsService, invites };
}

function payload(overrides?: Partial<any>): any {
  const baseRoom = {
    id: 10,
    isPrivate: false,
    status: 'setup',
    startedAt: null,
    owner: { id: 1, username: 'owner' },
    players: [{ id: 2, username: 'p2' }],
    spectators: [],
    bots: [],
  };
  const overridesObj = (overrides ?? {}) as any;
  const roomOverrides = overridesObj.room ?? {};
  const { room: _roomIgnored, ...rest } = overridesObj;
  return {
    room: { ...baseRoom, ...roomOverrides },
    manifest: null,
    generatedAt: new Date().toISOString(),
    ...rest,
  };
}

describe('RoomGateway.canSpectate', () => {
  it('returns false for banned users', async () => {
    const { gateway, roomsService } = createGateway();
    roomsService.isBanned.mockReturnValueOnce(true);

    const allowed = await gateway.canSpectate(10, 5);

    expect(allowed).toBe(false);
    expect(roomsService.getRoomPayload).not.toHaveBeenCalled();
  });

  it('returns true on public rooms', async () => {
    const { gateway, roomsService } = createGateway();
    roomsService.getRoomPayload.mockResolvedValueOnce(
      payload({ room: { isPrivate: false } }),
    );

    const allowed = await gateway.canSpectate(10, 5);

    expect(allowed).toBe(true);
  });

  it('returns true on private room for owner', async () => {
    const { gateway, roomsService } = createGateway();
    roomsService.getRoomPayload.mockResolvedValueOnce(
      payload({
        room: { isPrivate: true, owner: { id: 5, username: 'me' } },
      }),
    );

    const allowed = await gateway.canSpectate(10, 5);
    expect(allowed).toBe(true);
  });

  it('returns true on private room for existing participant', async () => {
    const { gateway, roomsService } = createGateway();
    roomsService.getRoomPayload.mockResolvedValueOnce(
      payload({
        room: {
          isPrivate: true,
          players: [
            { id: 2, username: 'p2' },
            { id: 5, username: 'me' },
          ],
        },
      }),
    );

    const allowed = await gateway.canSpectate(10, 5);
    expect(allowed).toBe(true);
  });

  it('returns invite-based decision for private started room', async () => {
    const { gateway, roomsService, invites } = createGateway();
    roomsService.getRoomPayload.mockResolvedValueOnce(
      payload({
        room: {
          isPrivate: true,
          status: 'started',
          startedAt: '2026-03-02T12:00:00.000Z',
          owner: { id: 1, username: 'owner' },
          players: [{ id: 2, username: 'p2' }],
        },
      }),
    );
    invites.canSpectate.mockReturnValueOnce(true);

    const allowed = await gateway.canSpectate(10, 5);
    expect(allowed).toBe(true);
    expect(invites.canSpectate).toHaveBeenCalledWith(10, 5);
  });

  it('returns false for private setup room when user is not owner/participant', async () => {
    const { gateway, roomsService, invites } = createGateway();
    roomsService.getRoomPayload.mockResolvedValueOnce(
      payload({
        room: {
          isPrivate: true,
          status: 'setup',
          startedAt: null,
          owner: { id: 1, username: 'owner' },
          players: [{ id: 2, username: 'p2' }],
        },
      }),
    );

    const allowed = await gateway.canSpectate(10, 5);
    expect(allowed).toBe(false);
    expect(invites.canSpectate).not.toHaveBeenCalled();
  });
});
