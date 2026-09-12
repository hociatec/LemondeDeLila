import { ListRecentNormalizedChatMessagesService } from './list-recent-normalized-chat-messages.service';

it('builds chat history from persistence instead of a stale process cache', async () => {
  const stale = [{ id: 'stale' }];
  const authoritative = [{ id: 'current' }];
  const normalized = [{ id: 'current', text: 'latest' }];
  const cache = {
    getAll: jest.fn().mockReturnValue(stale),
    setAll: jest.fn(),
  };
  const presenter = {
    normalizeMany: jest.fn().mockReturnValue(normalized),
  };
  const listRecentMessages = {
    execute: jest.fn().mockResolvedValue(authoritative),
  };
  const service = new ListRecentNormalizedChatMessagesService(
    cache as ConstructorParameters<
      typeof ListRecentNormalizedChatMessagesService
    >[0],
    presenter as ConstructorParameters<
      typeof ListRecentNormalizedChatMessagesService
    >[1],
    listRecentMessages as ConstructorParameters<
      typeof ListRecentNormalizedChatMessagesService
    >[2],
  );

  await expect(service.execute(20)).resolves.toEqual(normalized);
  expect(cache.getAll).not.toHaveBeenCalled();
  expect(listRecentMessages.execute).toHaveBeenCalledWith(2000);
  expect(presenter.normalizeMany).toHaveBeenCalledWith(authoritative);
  expect(cache.setAll).toHaveBeenCalledWith(normalized);
});
