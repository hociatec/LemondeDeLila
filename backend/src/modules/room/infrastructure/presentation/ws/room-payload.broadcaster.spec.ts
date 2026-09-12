import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import { RoomPayloadBroadcaster } from './room-payload.broadcaster';
import {
  buildTestRoomPayload,
  buildTestSocket,
} from './tests/backend-test-builders';

it('separates permissions, reuses identical frames and prunes broken sockets', async () => {
  const owner = buildTestSocket();
  const guest = buildTestSocket();
  const silentGuest = buildTestSocket();
  const broken = buildTestSocket();
  broken.send.mockImplementation(() => {
    throw new Error('closed');
  });
  const clients = new Map([
    [owner, { userId: 1 }],
    [guest, { userId: 2 }],
    [silentGuest, { userId: 2 }],
    [broken, { userId: 3 }],
  ]);
  const rooms = new Map([[10, new Set([owner, guest, broken])]]);
  const silentRooms = new Map([[10, new Set([silentGuest])]]);
  const presenter = new RoomGatewayStatePresenter();
  const present = jest.spyOn(presenter, 'presentRoomUpdated');
  const broadcaster = new RoomPayloadBroadcaster(
    new RoomClientPolicyService(),
    presenter,
  );
  const fixture = buildTestRoomPayload();
  const payload = { ...fixture, room: { ...fixture.room, bots: [] } };
  const before = structuredClone(payload);
  await broadcaster.broadcast({ clients, rooms, silentRooms }, 10, payload, {
    streamId: 'process-a',
    sequence: 7,
    snapshot: true,
  });
  expect(owner.send).toHaveBeenCalledTimes(1);
  expect(guest.send).toHaveBeenCalledTimes(1);
  expect(silentGuest.send.mock.calls[0][0]).toEqual(
    guest.send.mock.calls[0][0],
  );
  expect(owner.send.mock.calls[0][0]).not.toEqual(guest.send.mock.calls[0][0]);
  expect(present).toHaveBeenCalledTimes(2);
  expect(rooms.get(10)?.has(broken)).toBe(false);
  expect(broken.close).toHaveBeenCalledTimes(1);
  expect(payload).toEqual(before);
  expect(JSON.parse(String(owner.send.mock.calls[0][0]))).toMatchObject({
    realtime: { streamId: 'process-a', sequence: 7, snapshot: true },
  });
});
