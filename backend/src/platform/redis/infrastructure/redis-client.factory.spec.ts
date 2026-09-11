const mockClient = { on: jest.fn() };
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockClient),
}));
import Redis from 'ioredis';
import { RedisClientFactory } from './redis-client.factory';
import { RedisSessionStore } from '../../session/infrastructure/persistence/redis-session-store';
import { RedisPubSubTransport } from '../../pubsub/redis-pubsub.transport';

beforeEach(() => jest.clearAllMocks());

it('forbids replay of unacknowledged writes even when a caller requests it', () => {
  new RedisClientFactory().create('redis://localhost', 'test', {
    autoResendUnfulfilledCommands: true,
  });
  expect(Redis).toHaveBeenCalledWith(
    'redis://localhost',
    expect.objectContaining({ autoResendUnfulfilledCommands: false }),
  );
});

it('applies the same rule to the session and default pubsub clients', () => {
  new RedisSessionStore('redis://localhost');
  new RedisPubSubTransport('redis://localhost', 'test', () => null);
  expect(Redis).toHaveBeenCalledTimes(3);
  for (let index = 1; index <= 3; index++)
    expect(Redis).toHaveBeenNthCalledWith(
      index,
      'redis://localhost',
      expect.objectContaining({ autoResendUnfulfilledCommands: false }),
    );
});
