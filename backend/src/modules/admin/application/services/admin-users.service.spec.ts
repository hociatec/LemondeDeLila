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
      create: jest.fn(async (data: any) => ({
        id: 1,
        createdAt: null,
        ...data,
      })),
      save: jest.fn(async (data: any) => data),
      delete: jest.fn(async () => undefined),
    } as any;
  }

  function createService(repo: any) {
    const passwords = {
      generateTemporaryPassword: jest.fn(() => 'TempPass123!'),
      hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
    } as any;
    const bans = {
      sanitizeReason: jest.fn((value: string) =>
        String(value ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 255),
      ),
      resolveBannedUntil: jest.fn(() => null),
    } as any;
    return new AdminUsersCommandService(repo, passwords, bans);
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
    const service = createService(repo);

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
    const service = createService(repo);

    await expect(service.update(8, { password: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate email on create', async () => {
    const repo = createRepositoryMock();
    repo.findByEmail.mockResolvedValueOnce({ id: 9, email: 'dup@example.com' });
    const service = createService(repo);

    await expect(
      service.create({
        email: 'dup@example.com',
        username: 'fresh-user',
        roles: ['ROLE_USER'],
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('normalizes identities and converts concurrent DB uniqueness failures', async () => {
    const repo = createRepositoryMock();
    repo.findByEmail.mockResolvedValue(null);
    repo.findByUsername.mockResolvedValue(null);
    repo.create.mockRejectedValue({ code: 'ER_DUP_ENTRY', errno: 1062 });
    const service = createService(repo);

    await expect(
      service.create({
        email: '  Alice@Example.COM ',
        username: '  Alice  ',
        password: 'StrongPassword123!',
        roles: ['ROLE_USER'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(repo.findByUsername).toHaveBeenCalledWith('Alice');
  });

  it('throws when deleting unknown user', async () => {
    const repo = createRepositoryMock();
    repo.findById.mockResolvedValue(null);
    const service = createService(repo);

    await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
