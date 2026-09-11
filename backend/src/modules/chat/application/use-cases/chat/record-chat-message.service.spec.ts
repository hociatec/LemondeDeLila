import { asUserId } from '../../../../../shared/interfaces/public-api';
import type { ChatMessageRepository } from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import { ChatValidator } from './chat.validator';
import { RecordChatMessageService } from './record-chat-message.service';

function setup(now: number) {
  const messages: jest.Mocked<ChatMessageRepository> = {
    create: jest.fn(),
    listRecent: jest.fn(),
    listForAdmin: jest.fn(),
    findByMessageId: jest.fn(),
    updateMessage: jest.fn(),
    deleteById: jest.fn(),
    deleteByMessageId: jest.fn(),
    deleteAll: jest.fn(),
  };
  const cache = new ChatMessageCacheService();
  const service = new RecordChatMessageService(
    messages,
    new ChatValidator(),
    cache,
    { now: () => now },
  );
  return { service, messages, cache };
}

const user = { id: asUserId(1), username: 'Lila' };

it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, 0.5])(
  'rejects invalid clock %s before persistence or caching',
  async (now) => {
    const { service, messages, cache } = setup(now);
    await expect(service.execute(user, 'Bonjour')).rejects.toThrow(RangeError);
    expect(messages.create).not.toHaveBeenCalled();
    expect(cache.getAll()).toBeNull();
  },
);

it('persists and exposes the exact business instant, including epoch zero', async () => {
  const { service, messages, cache } = setup(0);
  const result = await service.execute(user, 'Bonjour');
  expect(messages.create).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: user.id,
      createdAt: new Date(0),
      message: 'Bonjour',
    }),
  );
  expect(result.createdAt).toBe('1970-01-01T00:00:00.000Z');
  expect(cache.getAll()).toEqual([result]);
});
