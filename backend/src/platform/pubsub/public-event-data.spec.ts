import Redis from 'ioredis';
import { RedisPubSubTransport } from './redis-pubsub.transport';

it('does not serialize entity instances onto Redis and accepts plain event records', async () => {
  const clients: Redis[] = [];
  const transport = new RedisPubSubTransport<unknown>(
    'redis://unused',
    'test',
    (value) => value,
    () => {
      const client = new Redis({ lazyConnect: true });
      clients.push(client);
      return client;
    },
  );
  const publish = jest.spyOn(clients[0], 'publish').mockResolvedValue(1);
  const toJSON = jest.fn(() => ({ secret: true }));
  class Entity {
    toJSON = toJSON;
  }
  try {
    await transport.publish({ nested: new Entity() });
    expect(publish).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    await transport.publish({ id: 1, optional: undefined });
    expect(publish).toHaveBeenCalledWith(
      'test',
      expect.stringContaining('"event":{"id":1}'),
    );
  } finally {
    publish.mockRestore();
    await transport.disconnect();
  }
});
