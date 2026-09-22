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
  jest.useFakeTimers();
  try {
    receive(event, { eventId: 'event-one' } as never);
    jest.advanceTimersByTime(299999);
    jest.setSystemTime(new Date('2000-01-01'));
    receive(event, { eventId: 'event-one' } as never);
    expect(socket.send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    receive(event, { eventId: 'event-one' } as never);
    expect(socket.send).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
    await service.onModuleDestroy();
  }
});
