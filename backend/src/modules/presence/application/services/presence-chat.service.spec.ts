import { PresenceChatService } from './presence-chat.service';
import type { PresenceChatPort } from '../ports/presence-chat.port';

it('denies chat consistently for a corrupt ban without serializing an invalid date', async () => {
  const chat: PresenceChatPort = {
    getHistory: jest.fn(),
    recordMessage: jest.fn(),
    editOwnMessage: jest.fn(),
    deleteOwnMessage: jest.fn(),
  };
  const users = {
    findChatBanByUserId: jest.fn().mockResolvedValue({
      chatBannedUntil: new Date(NaN),
      chatBanReason: 'test',
    }),
  };
  const service = new PresenceChatService(chat, users, { now: () => 1000 });
  expect(await service.isChatBannedNow(42)).toBe(true);
  expect(await service.getActiveChatBanPayload(42)).toEqual({
    message: 'Accès au tchat refusé.',
    until: null,
    reason: 'test',
  });
});

it('expires bans and cached ban information using the injected business clock', async () => {
  let now = 1_000;
  const chat: PresenceChatPort = {
    getHistory: jest.fn(),
    recordMessage: jest.fn(),
    editOwnMessage: jest.fn(),
    deleteOwnMessage: jest.fn(),
  };
  const users = {
    findChatBanByUserId: jest.fn().mockResolvedValue({
      chatBannedUntil: new Date(5_000),
      chatBanReason: 'test',
    }),
  };
  const service = new PresenceChatService(chat, users, { now: () => now });
  expect(await service.isChatBannedNow(42)).toBe(true);
  now = 5_000;
  expect(await service.isChatBannedNow(42)).toBe(false);
  expect(await service.getActiveChatBanPayload(42)).toBeNull();
  expect(users.findChatBanByUserId).toHaveBeenCalledTimes(1);
  now = 11_000;
  await service.getChatBanInfo(42);
  expect(users.findChatBanByUserId).toHaveBeenCalledTimes(2);
});

it('checks persistence before a chat command even when an allowed value is cached', async () => {
  const chat: PresenceChatPort = {
    getHistory: jest.fn(),
    recordMessage: jest.fn(),
    editOwnMessage: jest.fn(),
    deleteOwnMessage: jest.fn(),
  };
  const users = {
    findChatBanByUserId: jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        chatBannedUntil: new Date(10_000),
        chatBanReason: 'moderation',
      }),
  };
  const service = new PresenceChatService(chat, users, { now: () => 1_000 });
  await expect(service.getChatBanInfo(42)).resolves.toEqual({
    until: null,
    reason: null,
  });

  await expect(
    service.sendMessage({ id: 42, username: 'Ada' }, 'hello'),
  ).resolves.toEqual({
    kind: 'denied',
    payload: {
      message: 'Accès au tchat refusé.',
      reason: 'moderation',
      until: new Date(10_000).toISOString(),
    },
  });
  expect(chat.recordMessage).not.toHaveBeenCalled();
  expect(users.findChatBanByUserId).toHaveBeenCalledTimes(2);
});
