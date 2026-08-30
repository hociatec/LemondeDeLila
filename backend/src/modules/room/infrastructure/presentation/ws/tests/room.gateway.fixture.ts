import { RoomGatewayActionsService } from '../room-gateway-actions.service';
import { RoomGatewayCommandService } from '../room-gateway-command.service';
import { RoomGatewayLifecycleService } from '../room-gateway-lifecycle.service';
import { RoomGatewayLifecyclePresenter } from '../room-gateway-lifecycle.presenter';
import { RoomGatewayPresenceService } from '../room-gateway-presence.service';
import { RoomJoinPolicyService } from '../../../../application/services/membership/room-join-policy.service';
import { RoomAdminPolicyService } from '../../../../application/services/maintenance/room-admin-policy.service';
import { RoomGatewayPresenter } from '../room-gateway.presenter';
import { buildTestRoomPayload, buildTestSocket } from './backend-test-builders';

export type GatewayFixture = {
  gateway: any;
  deps: {
    roomsService: any;
  };
};

export function createSocket() {
  return buildTestSocket() as any;
}

export function baseRoomPayload(overrides?: Partial<any>): any {
  return buildTestRoomPayload(overrides);
}

export function createGatewayFixture(): GatewayFixture {
  const roomsService: any = {
    createRoom: jest.fn().mockResolvedValue({
      id: 10,
      name: 'Table test',
      isPrivate: false,
      maxPlayers: 6,
      status: 'setup',
      gameType: 'lama',
      startedAt: null,
      runId: null,
    }),
    joinRoom: jest.fn().mockResolvedValue({ id: 10 }),
    leaveRoom: jest.fn().mockResolvedValue({ id: 10 }),
    startRoom: jest.fn().mockResolvedValue({
      id: 10,
      status: 'started',
      startedAt: new Date('2026-03-02T12:00:00.000Z'),
      runId: 3,
    }),
    getRoomPayload: jest.fn().mockResolvedValue(baseRoomPayload()),
    isBanned: jest.fn().mockReturnValue(false),
    invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
    primeRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
    updateRoomPayloadCache: jest
      .fn()
      .mockResolvedValue(baseRoomPayload({ room: { isPrivate: true } })),
    togglePrivacy: jest.fn().mockResolvedValue({ id: 10, isPrivate: true }),
    requireRoomForOwnerAction: jest.fn().mockResolvedValue({ id: 10 }),
    saveRoom: jest.fn().mockResolvedValue(undefined),
    transferOwnerIfCurrent: jest.fn().mockResolvedValue(undefined),
    resetRoom: jest.fn().mockResolvedValue({ id: 10 }),
  };
  const roomState: any = {
    getRoomPayload: roomsService.getRoomPayload,
    isBanned: roomsService.isBanned,
    invalidateRoomPayloadCache: roomsService.invalidateRoomPayloadCache,
    primeRoomPayloadCache: roomsService.primeRoomPayloadCache,
    updateRoomPayloadCache: roomsService.updateRoomPayloadCache,
    notifyRoomStateUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const catalog: any = {
    getGame: jest.fn().mockResolvedValue({
      id: 'lama',
      name: 'Lama',
      minPlayers: 2,
      maxPlayers: 6,
      chatEnabled: true,
      chatSoundsEnabled: true,
    }),
  };
  const perf: any = {
    measure: jest
      .fn()
      .mockImplementation(async (_metric: string, fn: any) => await fn()),
  };
  const realtimeTracker: any = {
    setSocketParticipantRoom: jest.fn(),
    clearSocket: jest.fn(),
  };
  const joinPolicy = new RoomJoinPolicyService();
  const lifecyclePresenter = new RoomGatewayLifecyclePresenter();
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
    perf,
    realtimeTracker,
    gatewayPresenter,
  ) as any;
  const commands = new RoomGatewayCommandService() as any;
  const presence = new RoomGatewayPresenceService(
    roomsService,
    roomState,
  ) as any;
  const clients = new Map();
  const rooms = new Map();
  const silentRooms = new Map();
  const pendingParticipantLeaves = new Map();
  const gateway: any = {
    broadcastRoomPayload: jest.fn().mockResolvedValue(undefined),
    broadcastRoomIntent: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn().mockResolvedValue(undefined),
    sendRoomState: jest.fn().mockResolvedValue(undefined),
    sendRoomStateToClient: jest.fn().mockResolvedValue(undefined),
    sendError: jest.fn().mockResolvedValue(undefined),
    leavePreviousRoomOnSwitch: jest.fn().mockResolvedValue(undefined),
    tryUpdateRoomPayload: jest.fn().mockResolvedValue(true),
    canSpectate: jest.fn().mockResolvedValue(true),
    withAllowedActionsForClient: jest.fn((payload: any) => payload),
  };
  const asRecord = (value: unknown): Record<string, unknown> =>
    value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const safeSend = (client: any, payload: unknown): void => {
    if (client.readyState === 1) client.send(JSON.stringify(payload));
  };
  const lifecycleContext = () => ({
    server: {} as any,
    rooms,
    silentRooms,
    clients,
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    resetClientRoomState: jest.fn(),
    hasUserConnections: (roomId: number, userId: number) =>
      presence.hasUserConnections(presenceContext(), roomId, userId),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    sendRoomStateToClient: (...args: any[]) =>
      gateway.sendRoomStateToClient(...args),
    broadcast: (...args: any[]) => gateway.broadcast(...args),
    broadcastRoomIntent: (...args: any[]) =>
      gateway.broadcastRoomIntent(...args),
    broadcastRoomPayload: (...args: any[]) =>
      gateway.broadcastRoomPayload(...args),
    sendError: (...args: any[]) => gateway.sendError(...args),
    safeSend,
    tryUpdateRoomPayload: (...args: any[]) =>
      gateway.tryUpdateRoomPayload(...args),
    canSpectate: (...args: any[]) => gateway.canSpectate(...args),
    leavePreviousRoomOnSwitch: (...args: any[]) =>
      gateway.leavePreviousRoomOnSwitch(...args),
    withAllowedActionsForClient: (...args: any[]) =>
      gateway.withAllowedActionsForClient(...args),
    asRecord,
  });
  const presenceContext = (): any => ({
    clients,
    rooms,
    silentRooms,
    pendingParticipantLeaves,
    participantDisconnectGraceMs: 60_000,
    clearRealtimeSocket: jest.fn(),
    stopHeartbeat: jest.fn(),
    deleteMessageQueue: jest.fn(),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    resetClientRoomState: jest.fn(),
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    sendRoomError: jest.fn(),
  });
  const actionsContext = () => ({
    server: {} as any,
    rooms,
    silentRooms,
    clients,
    broadcast: (...args: any[]) => gateway.broadcast(...args),
    broadcastRoomIntent: (...args: any[]) =>
      gateway.broadcastRoomIntent(...args),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    tryUpdateRoomPayload: (...args: any[]) =>
      gateway.tryUpdateRoomPayload(...args),
    sendError: (...args: any[]) => gateway.sendError(...args),
    safeSend,
    sendRoomError: jest.fn(),
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    hasUserConnections: (roomId: number, userId: number) =>
      presence.hasUserConnections(presenceContext(), roomId, userId),
    resetClientRoomState: jest.fn(),
    asRecord,
  });
  const commandContext = (): any => ({
    safeSend,
    asRecord,
    sendImmediateAckIfNeeded: (...args: any[]) =>
      gateway.sendImmediateAckIfNeeded(...args),
    executeLegacyRoomCommand: (...args: any[]) =>
      gateway.executeLegacyRoomCommand(...args),
    handleRoomLeave: jest.fn().mockResolvedValue(undefined),
    handleChatSend: jest.fn().mockResolvedValue(undefined),
    handleChatHistory: jest.fn().mockResolvedValue(undefined),
    handleRoomStart: (...args: any[]) => gateway.handleRoomStart(...args),
    handleRoomReset: jest.fn().mockResolvedValue(undefined),
    handleSetRole: (...args: any[]) => gateway.handleSetRole(...args),
    handleKickOrBan: jest.fn().mockResolvedValue(undefined),
    handleSetOwner: jest.fn().mockResolvedValue(undefined),
    handleSetAmbience: jest.fn().mockResolvedValue(undefined),
    handleTogglePrivacy: (...args: any[]) =>
      gateway.handleTogglePrivacy(...args),
    handleRoomInfo: jest.fn().mockResolvedValue(undefined),
    handleBotAdd: jest.fn().mockResolvedValue(undefined),
    handleBotRemove: jest.fn().mockResolvedValue(undefined),
    handleRoomCreate: (...args: any[]) => gateway.handleRoomCreate(...args),
    handleRoomJoin: (...args: any[]) => gateway.handleRoomJoin(...args),
  });
  gateway.handleRoomCreate = (...args: any[]) =>
    lifecycle.handleRoomCreate(lifecycleContext(), ...args);
  gateway.handleRoomJoin = (...args: any[]) =>
    lifecycle.handleRoomJoin(lifecycleContext(), ...args);
  gateway.handleRoomStart = (...args: any[]) =>
    lifecycle.handleRoomStart(lifecycleContext(), ...args);
  gateway.handleTogglePrivacy = (...args: any[]) =>
    lifecycle.handleTogglePrivacy(lifecycleContext(), ...args);
  gateway.handleSetRole = (...args: any[]) =>
    actions.handleSetRole(actionsContext(), ...args);
  gateway.hasUserConnections = (roomId: number, userId: number) =>
    presence.hasUserConnections(presenceContext(), roomId, userId);
  gateway.scheduleDelayedParticipantLeave = (roomId: number, userId: number) =>
    presence.scheduleDelayedParticipantLeave(presenceContext(), roomId, userId);
  gateway.sendImmediateAckIfNeeded = (...args: any[]) =>
    commands.sendImmediateAckIfNeeded(commandContext(), ...args);
  gateway.executeLegacyRoomCommand = (...args: any[]) =>
    commands.executeLegacyRoomCommand(commandContext(), ...args);
  gateway.handleRoomIntentExecute = (...args: any[]) =>
    commands.handleRoomIntentExecute(commandContext(), ...args);

  return {
    gateway,
    deps: { roomsService },
  };
}
