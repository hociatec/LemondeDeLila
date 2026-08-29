import { BadRequestException } from '@nestjs/common';
import { AdminChatModerationService } from './admin-chat-moderation.service';

describe('AdminChatModerationService', () => {
  function createRepositoryMock() {
    return {
      findById: jest.fn(),
      save: jest.fn(async (data: any) => data),
    } as any;
  }

  it('bans a user with a default long duration', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue({
      id: 4,
      email: 'user@example.com',
      username: 'tester',
      password: 'hashed',
      roles: ['ROLE_USER'],
      chatBannedUntil: null,
      chatBanReason: null,
    });
    const service = new AdminChatModerationService(repo);

    const result = await service.ban({
      userId: 4,
      reason: ' spam ',
      byUserId: 99,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        chatBanReason: 'spam',
        chatBannedUntil: expect.any(Date),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        userId: 4,
        chatBanReason: 'spam',
        byUserId: 99,
      }),
    );
  });

  it('unbans a user', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue({
      id: 5,
      email: 'user@example.com',
      username: 'tester',
      password: 'hashed',
      roles: ['ROLE_USER'],
      chatBannedUntil: new Date(),
      chatBanReason: 'reason',
    });
    const service = new AdminChatModerationService(repo);

    const result = await service.unban({ userId: 5, byUserId: 42 });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        chatBannedUntil: null,
        chatBanReason: null,
      }),
    );
    expect(result).toEqual({ ok: true, userId: 5, byUserId: 42 });
  });

  it('fails when the user does not exist', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue(null);
    const service = new AdminChatModerationService(repo);

    await expect(
      service.ban({ userId: 999, byUserId: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
