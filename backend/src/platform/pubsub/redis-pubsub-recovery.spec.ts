import Redis from 'ioredis';
import { RedisPubSubTransport } from './redis-pubsub.transport';

function fixture() {
  const publisher = new Redis({ lazyConnect: true });
  const subscriber = new Redis({ lazyConnect: true });
  const subscribe = jest.spyOn(subscriber, 'subscribe').mockResolvedValue(1);
  const transport = new RedisPubSubTransport<{ id: number }>(
    'redis://unused',
    'test',
    (value) =>
      value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'number'
        ? { id: value.id }
        : null,
    (_url, name) => (name.endsWith(':pub') ? publisher : subscriber),
  );
  return { transport, subscriber, subscribe };
}

it('recovers an initially failed subscription and removes its listeners at shutdown', async () => {
  const { transport, subscriber, subscribe } = fixture();
  const receive = jest.fn();
  subscribe.mockRejectedValueOnce(new Error('Redis unavailable'));
  try {
    await expect(transport.subscribe(receive)).rejects.toThrow(
      'Redis unavailable',
    );
    subscriber.emit('ready');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(subscribe).toHaveBeenCalledTimes(2);
    subscriber.emit('ready');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(subscriber.listenerCount('message')).toBe(1);
    subscriber.emit('message', 'test', JSON.stringify({ id: 7 }));
    expect(receive).toHaveBeenCalledTimes(1);
    await transport.disconnect();
    expect(subscriber.listenerCount('message')).toBe(0);
    expect(subscriber.listenerCount('ready')).toBe(0);
    subscriber.emit('ready');
    subscriber.emit('message', 'test', JSON.stringify({ id: 8 }));
    expect(subscribe).toHaveBeenCalledTimes(3);
    expect(receive).toHaveBeenCalledTimes(1);
  } finally {
    await transport.disconnect();
  }
});

it('coalesces concurrent subscriptions and gives each consumer detached data', async () => {
  const { transport, subscriber, subscribe } = fixture();
  let release = () => {};
  subscribe.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        release = () => resolve(1);
      }),
  );
  const received: number[] = [];
  try {
    const first = transport.subscribe((event) => {
      event.id = 99;
    });
    const second = transport.subscribe((event) => {
      received.push(event.id);
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    subscriber.emit('message', 'test', JSON.stringify({ id: 7 }));
    expect(received).toEqual([7]);
  } finally {
    await transport.disconnect();
  }
});

it('resubscribes when an old connection command fails after Redis is ready again', async () => {
  const { transport, subscriber, subscribe } = fixture();
  let fail = () => {};
  subscribe.mockImplementationOnce(
    () =>
      new Promise<number>((_resolve, reject) => {
        fail = () => reject(new Error('Old connection lost'));
      }),
  );
  try {
    const initial = transport.subscribe(() => {});
    const rejection = expect(initial).rejects.toThrow('Old connection lost');
    subscriber.emit('ready');
    fail();
    await rejection;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(subscribe).toHaveBeenCalledTimes(2);
  } finally {
    await transport.disconnect();
  }
});
