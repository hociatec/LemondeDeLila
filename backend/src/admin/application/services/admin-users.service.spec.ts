import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminUsersCommandService } from '../use-cases/admin-users/admin-users-command.service';

describe('AdminUsersCommandService', () => {
  function createRepositoryMock() {
    return {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(async (data: any) => ({ id: 1, createdAt: null, ...data })),
      save: jest.fn(async (data: any) => data),
      delete: jest.fn(async () => undefined),
    } as any;
  }

  it('normalizes and truncates ban reason', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue({
      id: 7,
      email: 'user@example.com',
      username: 'tester',
      password: 'hashed',
      roles: ['ROLE_USER'],
    });
    const service = new AdminUsersCommandService(repo);

    const result = await service.ban(
      7,
      `   raison   avec   espaces   ${'x'.repeat(400)}   `,
      1,
    );

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        banReason: expect.stringMatching(/^raison avec espaces /),
      }),
    );
    expect(String(result.user.banReason).length).toBeLessThanOrEqual(255);
  });

  it('rejects blank password update', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue({
      id: 8,
      email: 'user@example.com',
      username: 'tester',
      password: 'hashed',
      roles: ['ROLE_USER'],
    });
    const service = new AdminUsersCommandService(repo);

    await expect(service.update(8, { password: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate email on create', async () => {
    const repo = createRepositoryMock();
    repo.findByEmail.mockResolvedValueOnce({ id: 9, email: 'dup@example.com' });
    const service = new AdminUsersCommandService(repo);

    await expect(
      service.create({
        email: 'dup@example.com',
        username: 'fresh-user',
        roles: ['ROLE_USER'],
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when deleting unknown user', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue(null);
    const service = new AdminUsersCommandService(repo);

    await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
