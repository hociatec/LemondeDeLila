import { RoomEventsBusService } from './room-events-bus.service';

it('releases every listener and rejects subscriptions after destruction', async () => {
  const bus = new RoomEventsBusService();
  const listener = jest.fn();
  bus.onRoomDeleted(listener);
  bus.onRoomStateUpdated(listener);
  bus.onLobbyChanged(listener);
  await bus.publishRoomDeleted(1);
  await bus.publishRoomStateUpdated(1);
  await bus.publishLobbyChanged(1, 'reset');
  expect(listener).toHaveBeenCalledTimes(3);
  bus.onModuleDestroy();
  bus.onModuleDestroy();
  bus.onRoomDeleted(listener);
  bus.onRoomStateUpdated(listener);
  bus.onLobbyChanged(listener);
  await bus.publishRoomDeleted(1);
  await bus.publishRoomStateUpdated(1);
  await bus.publishLobbyChanged(1, 'reset');
  expect(listener).toHaveBeenCalledTimes(3);
});
