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
