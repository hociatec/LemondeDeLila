import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import type { UserModel } from '../../domain/models/user.model';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { RefreshTokenServicePort } from '../ports/refresh-token.port';
import type { UserTokenServicePort } from '../ports/user-token.port';
import type { UserRepository } from '../ports/user.repository';
import { LoginUserService } from './login-user.service';
import { RefreshUserSessionService } from './refresh-user-session.service';
import { RegisterUserService } from './register-user.service';

const user = (overrides: Partial<UserModel> = {}): UserModel => ({
  id: 1,
  email: 'alice@example.test',
  username: 'Alice',
  password: '$2b$hash',
  roles: ['ROLE_USER'],
  avatar: null,
  preferences: null,
  bannedUntil: null,
  banReason: null,
  chatBannedUntil: null,
  chatBanReason: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const repository = (): jest.Mocked<UserRepository> => ({
  listPublic: jest.fn(),
  listStaff: jest.fn(),
  findPublicById: jest.fn(),
  findById: jest.fn(),
  findByUsername: jest.fn(),
  existsByUsername: jest.fn().mockResolvedValue(false),
  existsByEmail: jest.fn().mockResolvedValue(false),
  create: jest.fn().mockResolvedValue(user()),
  save: jest.fn(async (value) => value),
});

const hasher = (): jest.Mocked<PasswordHasherPort> => ({
  hash: jest.fn().mockResolvedValue('$2b$hash'),
  compare: jest.fn().mockResolvedValue(true),
});

const tokens = (): jest.Mocked<UserTokenServicePort> => ({
  sign: jest.fn().mockReturnValue('access-token'),
});

const refreshTokens = (): jest.Mocked<RefreshTokenServicePort> => ({
  issue: jest.fn().mockResolvedValue('refresh-token'),
  rotate: jest
    .fn()
    .mockResolvedValue({ userId: 1, refreshToken: 'rotated-token' }),
  revoke: jest.fn().mockResolvedValue(undefined),
});

describe('user authentication use cases', () => {
  it.each(['login', 'refresh'] as const)(
    'uses the injected ban deadline for %s',
    async (operation) => {
      let now = 999;
      const clock = { now: () => now };
      const users = repository();
      const account = user({ bannedUntil: new Date(1000) });
      users.findByUsername.mockResolvedValue(account);
      users.findById.mockResolvedValue(account);
      const signer = tokens();
      const refresh = refreshTokens();
      const login = new LoginUserService(
        users,
        hasher(),
        signer,
        refresh,
        clock,
      );
      const renewal = new RefreshUserSessionService(
        users,
        signer,
        refresh,
        clock,
      );
      const execute = () =>
        operation === 'login'
          ? login.execute({ username: 'Alice', password: 'secret' })
          : renewal.execute('old-token');
      await expect(execute()).rejects.toBeInstanceOf(UnauthorizedException);
      expect(signer.sign).not.toHaveBeenCalled();
      now = 1000;
      await expect(execute()).resolves.toMatchObject({ token: 'access-token' });
      expect(account.bannedUntil).toBeNull();
    },
  );
  it('refuses corrupt ban dates during login and refresh', async () => {
    const users = repository();
    users.findByUsername.mockResolvedValue(
      user({ bannedUntil: new Date(NaN) }),
    );
    users.findById.mockResolvedValue(user({ bannedUntil: new Date(NaN) }));
    const refresh = refreshTokens();
    const signer = tokens();
    await expect(
      new LoginUserService(users, hasher(), signer, refresh, {
        now: () => Date.now(),
      }).execute({
        username: 'Alice',
        password: 'secret',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      new RefreshUserSessionService(users, signer, refresh, {
        now: () => Date.now(),
      }).execute('old-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signer.sign).not.toHaveBeenCalled();
    expect(refresh.issue).not.toHaveBeenCalled();
    expect(refresh.revoke).toHaveBeenCalledWith('rotated-token');
  });
  it('normalizes registration identity and hashes a policy-compliant password', async () => {
    const users = repository();
    const passwords = hasher();
    const service = new RegisterUserService(users, passwords);

    await service.execute({
      email: '  ALICE@Example.Test ',
      username: '  Alice_42 ',
      password: 'correct horse battery staple',
    });

    expect(passwords.hash).toHaveBeenCalledWith('correct horse battery staple');
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@example.test',
        username: 'Alice_42',
      }),
    );
  });

  it('rejects a weak password even when the use case bypasses DTO validation', async () => {
    const service = new RegisterUserService(repository(), hasher());
    await expect(
      service.execute({
        email: 'alice@example.test',
        username: 'Alice',
        password: 'short',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converts a concurrent MySQL uniqueness failure into a public conflict', async () => {
    const users = repository();
    users.create.mockRejectedValue({ code: 'ER_DUP_ENTRY', errno: 1062 });
    const service = new RegisterUserService(users, hasher());

    await expect(
      service.execute({
        email: 'alice@example.test',
        username: 'Alice',
        password: 'correct horse battery staple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in an active user and rotates session credentials', async () => {
    const users = repository();
    users.findByUsername.mockResolvedValue(user());
    const refresh = refreshTokens();
    const service = new LoginUserService(users, hasher(), tokens(), refresh, {
      now: () => Date.now(),
    });

    await expect(
      service.execute({ username: ' Alice ', password: 'secret' }),
    ).resolves.toEqual({
      token: 'access-token',
      refreshToken: 'refresh-token',
      userId: 1,
      username: 'Alice',
    });
    expect(users.findByUsername).toHaveBeenCalledWith('Alice');
  });

  it('rejects invalid credentials and banned users', async () => {
    const users = repository();
    users.findByUsername.mockResolvedValue(
      user({ bannedUntil: new Date('2999-01-01T00:00:00Z') }),
    );
    const service = new LoginUserService(
      users,
      hasher(),
      tokens(),
      refreshTokens(),
      { now: () => Date.now() },
    );
    await expect(
      service.execute({ username: 'Alice', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh-token reuse and revokes a rotated token for a deleted user', async () => {
    const users = repository();
    users.findById.mockResolvedValue(null);
    const refresh = refreshTokens();
    const service = new RefreshUserSessionService(users, tokens(), refresh, {
      now: () => Date.now(),
    });

    await expect(service.execute('old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refresh.revoke).toHaveBeenCalledWith('rotated-token');

    refresh.rotate.mockResolvedValueOnce(null);
    await expect(service.execute('reused-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
