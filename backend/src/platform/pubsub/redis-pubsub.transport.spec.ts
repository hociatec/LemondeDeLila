import { RedisPubSubTransport } from './redis-pubsub.transport';
import {
  currentCorrelationId,
  runWithCorrelationId,
} from '../observability/public-api';

describe('RedisPubSubTransport degradation', () => {
  const setup = () => {
    const publisher = {
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
      publish: jest.fn().mockRejectedValue(new Error('redis down')),
      disconnect: jest.fn(),
      on: jest.fn(),
      subscribe: jest.fn(),
    };
    const subscriber = {
      ...publisher,
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
      disconnect: jest.fn(),
      on: jest.fn(),
    };
    const clients = [publisher, subscriber];
    const transport = new RedisPubSubTransport<{ id: number }>(
      'redis://test',
      'events',
      (value) => value as { id: number },
      () => clients.shift() as any,
    );
    return { transport, publisher, subscriber };
  };

  it('treats connection and publication as explicit best effort', async () => {
    const { transport } = setup();
    await expect(transport.connect()).resolves.toBeUndefined();
    await expect(transport.publish({ id: 1 })).resolves.toBeUndefined();
  });

  it('disconnects both owned clients during shutdown', async () => {
    const { transport, publisher, subscriber } = setup();
    await transport.disconnect();
    expect(publisher.disconnect).toHaveBeenCalledTimes(1);
    expect(subscriber.disconnect).toHaveBeenCalledTimes(1);
  });

  it('propagates correlation context through the Redis envelope', async () => {
    const publish = jest.fn().mockResolvedValue(1);
    let receive: ((channel: string, message: string) => void) | undefined;
    const publisher = {
      publish,
      disconnect: jest.fn(),
    };
    const subscriber = {
      on: jest.fn(
        (
          _event: string,
          listener: (channel: string, message: string) => void,
        ) => {
          receive = listener;
        },
      ),
      subscribe: jest.fn().mockResolvedValue(1),
      disconnect: jest.fn(),
    };
    const clients = [publisher, subscriber];
    const transport = new RedisPubSubTransport<{ id: number }>(
      'redis://test',
      'events',
      (value) => value as { id: number },
      () => clients.shift() as never,
    );

    await runWithCorrelationId('request-42', () =>
      transport.publish({ id: 7 }),
    );
    const published = JSON.parse(publish.mock.calls[0][1] as string) as {
      correlationId: string;
      event: { id: number };
    };
    expect(published).toEqual({
      kind: 'lila.pubsub',
      correlationId: 'request-42',
      event: { id: 7 },
    });

    const observed: Array<{
      event: { id: number };
      correlationId: string | undefined;
    }> = [];
    await transport.subscribe((event) => {
      observed.push({ event, correlationId: currentCorrelationId() });
    });
    receive?.('events', JSON.stringify(published));
    expect(observed).toEqual([
      { event: { id: 7 }, correlationId: 'request-42' },
    ]);
  });
});
