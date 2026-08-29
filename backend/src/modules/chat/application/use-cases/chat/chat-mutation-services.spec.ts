import {
  ChatMessageAccessDeniedError,
  ChatMessageEditWindowExpiredError,
  ChatMessageDeleteWindowExpiredError,
  ChatMessageRequiredError,
} from '../../../domain/errors/chat-domain.errors';
import type { ChatMessageRecord } from '../../models/chat-message.record';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import { ChatMessagePresenterService } from '../../services/chat-message-presenter.service';
import { EditOwnChatMessageService } from './edit-own-chat-message.service';
import { DeleteOwnChatMessageService } from './delete-own-chat-message.service';
import { ChatValidator } from './chat.validator';

describe('chat mutation services', () => {
  const record = (createdAt = new Date()): ChatMessageRecord => ({
    id: 10,
    messageId: 'message-10',
    message: 'before',
    createdAt,
    deletedAt: null,
    user: { id: 1, username: 'Alice', avatar: null },
  });

  it('rejects empty messages after sanitization', () => {
    expect(() => new ChatValidator().validate('  \n  ')).toThrow(
      ChatMessageRequiredError,
    );
  });

  it('enforces ownership and edit time window', async () => {
    const messages = {
      findByMessageId: jest.fn().mockResolvedValue(record()),
      updateMessage: jest.fn(),
    };
    const settings = { getEditWindowSeconds: () => 60 };
    const service = new EditOwnChatMessageService(
      messages as any,
      new ChatValidator(),
      settings as any,
      new ChatMessagePresenterService(),
      new ChatMessageCacheService(),
    );
    await expect(
      service.execute(2, 'message-10', 'after'),
    ).rejects.toBeInstanceOf(ChatMessageAccessDeniedError);

    messages.findByMessageId.mockResolvedValue(
      record(new Date(Date.now() - 61_000)),
    );
    await expect(
      service.execute(1, 'message-10', 'after'),
    ).rejects.toBeInstanceOf(ChatMessageEditWindowExpiredError);
  });

  it('enforces ownership and time limits when deleting', async () => {
    const messages = {
      findByMessageId: jest.fn().mockResolvedValue(record()),
      deleteById: jest.fn().mockResolvedValue(true),
    };
    const cache = new ChatMessageCacheService();
    const service = new DeleteOwnChatMessageService(
      messages as any,
      { getEditWindowSeconds: () => 60 } as any,
      cache,
    );
    await expect(service.execute(2, 'message-10')).rejects.toBeInstanceOf(
      ChatMessageAccessDeniedError,
    );
    messages.findByMessageId.mockResolvedValue(
      record(new Date(Date.now() - 61_000)),
    );
    await expect(service.execute(1, 'message-10')).rejects.toBeInstanceOf(
      ChatMessageDeleteWindowExpiredError,
    );
  });

  it('makes repeated delete attempts harmless once the record is deleted', async () => {
    const deleted = record();
    deleted.deletedAt = new Date();
    const messages = {
      findByMessageId: jest.fn().mockResolvedValue(deleted),
      deleteById: jest.fn(),
    };
    const service = new DeleteOwnChatMessageService(
      messages as any,
      { getEditWindowSeconds: () => 60 } as any,
      new ChatMessageCacheService(),
    );
    await expect(service.execute(1, 'message-10')).resolves.toBe(true);
    expect(messages.deleteById).not.toHaveBeenCalled();
  });
});
