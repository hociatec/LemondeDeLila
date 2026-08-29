import { RedisPubSubTransport } from './redis-pubsub.transport';

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
});
