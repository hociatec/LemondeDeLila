import { WebSocket } from 'ws';
import { NotificationDispatchService } from './notification-dispatch.service';
import type { NotificationTransport } from '../transport/notification-transport';

it('deduplicates received notifications without extending their retention on duplicates', async () => {
  let receive: Parameters<NotificationTransport['subscribe']>[0] = () => {
    throw new Error('Not subscribed');
  };
  const transport: NotificationTransport = {
    connect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: (handler) => {
      receive = handler;
      return Promise.resolve();
    },
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const service = new NotificationDispatchService(transport);
  const socket = {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    close: jest.fn(),
  };
  service.register(7, socket as never);
  const event = {
    userId: 7,
    type: 'message.created',
    payload: { id: 'one' },
    origin: 'another-instance',
  };
  const now = jest.spyOn(Date, 'now');
  try {
    now.mockReturnValue(1000);
    receive(event, { eventId: 'event-one' } as never);
    now.mockReturnValue(300999);
    receive(event, { eventId: 'event-one' } as never);
    expect(socket.send).toHaveBeenCalledTimes(1);
    now.mockReturnValue(301000);
    receive(event, { eventId: 'event-one' } as never);
    expect(socket.send).toHaveBeenCalledTimes(2);
  } finally {
    now.mockRestore();
    await service.onModuleDestroy();
  }
});
