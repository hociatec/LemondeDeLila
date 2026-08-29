import { AdminChatService } from './admin-chat.service';

describe('AdminChatService', () => {
  it('maps messages to admin payload shape', async () => {
    const adminListMessages = jest.fn().mockResolvedValue([
      {
        messageId: 'm1',
        message: 'hello',
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        deletedAt: null,
        user: {
          id: 3,
          username: 'lila',
          avatar: 'a.png',
          chatBannedUntil: new Date('2026-01-02T12:00:00.000Z'),
          chatBanReason: 'spam',
        },
      },
    ]);
    const service = new AdminChatService(
      {
        adminListMessages,
        adminDeleteMessage: jest.fn(),
        adminClearAll: jest.fn(),
      } as any,
      {
        getChatHistoryLimit: jest.fn().mockReturnValue(50),
        getSettings: jest.fn(),
        updateSettings: jest.fn(),
      } as any,
    );

    await expect(service.listMessages({})).resolves.toEqual([
      {
        id: 'm1',
        text: 'hello',
        createdAt: '2026-01-01T12:00:00.000Z',
        deletedAt: null,
        user: {
          id: 3,
          username: 'lila',
          avatar: 'a.png',
          chatBannedUntil: '2026-01-02T12:00:00.000Z',
          chatBanReason: 'spam',
        },
      },
    ]);

    expect(adminListMessages).toHaveBeenCalledWith(50, false);
  });

  it('delegates settings update', async () => {
    const updateSettings = jest
      .fn()
      .mockResolvedValue({ chatHistoryLimit: 100, editWindowSeconds: 60 });
    const service = new AdminChatService(
      {
        adminListMessages: jest.fn(),
        adminDeleteMessage: jest.fn(),
        adminClearAll: jest.fn(),
      } as any,
      {
        getChatHistoryLimit: jest.fn(),
        getSettings: jest.fn(),
        updateSettings,
      } as any,
    );

    await expect(
      service.updateSettings({ chatHistoryLimit: 100, editWindowSeconds: 60 }),
    ).resolves.toEqual({
      chatHistoryLimit: 100,
      editWindowSeconds: 60,
    });
  });

  it('wraps delete and clear results', async () => {
    const service = new AdminChatService(
      {
        adminListMessages: jest.fn(),
        adminDeleteMessage: jest.fn().mockResolvedValue(true),
        adminClearAll: jest.fn().mockResolvedValue(8),
      } as any,
      {
        getChatHistoryLimit: jest.fn(),
        getSettings: jest.fn(),
        updateSettings: jest.fn(),
      } as any,
    );

    await expect(service.deleteMessage('m1')).resolves.toEqual({ ok: true });
    await expect(service.clearMessages()).resolves.toEqual({ deleted: 8 });
  });
});
