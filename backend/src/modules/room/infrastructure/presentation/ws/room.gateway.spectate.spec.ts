import { RoomGatewaySessionService } from './room-gateway-session.service';
import { RoomGatewaySessionPresenter } from './room-gateway-session.presenter';
import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';

function createGateway() {
  const roomsService: any = {
    isBanned: jest.fn().mockReturnValue(false),
    getRoomPayload: jest.fn(),
  };
  const roomState: any = {
    getRoomPayload: roomsService.getRoomPayload,
    isBanned: roomsService.isBanned,
  };
  const invites: any = {
    canSpectate: jest.fn().mockReturnValue(false),
  };
  const clientPolicy = new RoomClientPolicyService();
  const sessionPresenter = new RoomGatewaySessionPresenter();
  const session = new RoomGatewaySessionService(
    clientPolicy,
    roomState,
    sessionPresenter,
  ) as any;
  const gateway = {
    canSpectate: (roomId: number, userId: number) =>
      session.canSpectate(
        roomId,
        userId,
        (nextRoomId: number, nextUserId: number) =>
          invites.canSpectate(nextRoomId, nextUserId),
      ),
  } as any;

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
