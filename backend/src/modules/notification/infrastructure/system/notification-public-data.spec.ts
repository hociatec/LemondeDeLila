import { WebSocket } from 'ws';
import { NotificationDispatchService } from './notification-dispatch.service';
import type { NotificationTransport } from '../transport/notification-transport';

it('rejects nested entity instances before publishing or local delivery, without calling toJSON', async () => {
  const toJSON = jest.fn(() => ({ passwordHash: 'private' }));
  class UserEntity {
    toJSON = toJSON;
  }
  const transport: NotificationTransport = {
    connect: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
  const service = new NotificationDispatchService(transport);
  const candidate: unknown = Reflect.construct(WebSocket, [
    null,
    undefined,
    {},
  ]);
  if (!(candidate instanceof WebSocket)) throw new Error('Invalid test socket');
  Object.defineProperty(candidate, 'readyState', { value: WebSocket.OPEN });
  const send = jest.spyOn(candidate, 'send').mockImplementation(() => {});
  service.register(1, candidate);
  try {
    await service.notifyUser(1, 'user.updated', { user: new UserEntity() });
    await service.notifyAll('user.updated', { user: new UserEntity() });
    expect(transport.publish).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    await service.notifyUser(1, 'user.updated', {
      user: { id: 1, optional: undefined },
    });
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'user.updated', payload: { user: { id: 1 } } }),
    );
    expect(transport.publish).toHaveBeenCalledTimes(1);
  } finally {
    send.mockRestore();
    service.unregister(1, candidate);
    await service.onModuleDestroy();
  }
});
