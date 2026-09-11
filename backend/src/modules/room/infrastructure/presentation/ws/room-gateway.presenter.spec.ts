import { RoomGatewayPresenter } from './room-gateway.presenter';
import { buildTestRoomPayload } from './tests/backend-test-builders';

it('projects added and removed bots without changing a cached room payload', () => {
  const presenter = new RoomGatewayPresenter();
  const fixture = buildTestRoomPayload();
  const original = {
    ...fixture,
    room: { ...fixture.room, bots: [] as Array<{ id: number; name: string }> },
  };
  const before = structuredClone(original);
  Object.freeze(original.room.bots);
  Object.freeze(original.room);
  Object.freeze(original);
  const added = presenter.updateRoomPayloadWithAddedBot(original, {
    id: 998,
    name: 'Bot',
  });
  expect(added.room.bots).toContainEqual({ id: 998, name: 'Bot' });
  expect(original).toEqual(before);
  const removed = presenter.updateRoomPayloadWithRemovedBot(added, 998);
  expect(removed.room.bots).not.toContainEqual({ id: 998, name: 'Bot' });
  expect(added.room.bots).toContainEqual({ id: 998, name: 'Bot' });
});
