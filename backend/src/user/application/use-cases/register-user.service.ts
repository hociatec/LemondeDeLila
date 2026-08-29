import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from '../ports/password-hasher.port';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';
import {
  assertPasswordPolicy,
  normalizeEmail,
  normalizeUsername,
  usernameIdentity,
} from '../../domain/policies/user-credentials.policy';

@Injectable()
export class RegisterUserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: {
    email: string;
    username: string;
    password: string;
    avatar?: string | null;
  }): Promise<void> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedUsername = normalizeUsername(input.username);
    await this.ensureUsernameAvailable(normalizedUsername);
    await this.ensureEmailAvailable(normalizedEmail);

    if (!input.password || input.password.trim() === '') {
      throw new BadRequestException('Mot de passe requis');
    }
    try {
      assertPasswordPolicy(input.password);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Mot de passe invalide',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    try {
      await this.users.create({
        email: normalizedEmail,
        username: normalizedUsername,
        password: passwordHash,
        roles: [],
        avatar: input.avatar?.trim() ? input.avatar.trim() : null,
        preferences: null,
        bannedUntil: null,
        banReason: null,
        chatBannedUntil: null,
        chatBanReason: null,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email ou nom utilisateur déjà utilisé');
      }
      throw error;
    }
  }

  private readonly reserved = new Set([
    'admin',
    'root',
    'system',
    'bot',
    'moderator',
    'mod',
    'administrator',
    'support',
    'help',
    'api',
    'test',
    'user',
    'guest',
    'anonymous',
    'null',
    'undefined',
    'server',
    'official',
    'staff',
    'team',
  ]);

  private async ensureUsernameAvailable(username: string): Promise<void> {
    if (this.reserved.has(usernameIdentity(username))) {
      throw new BadRequestException("Ce nom d'utilisateur est reserve");
    }
    if (await this.users.existsByUsername(username)) {
      throw new ConflictException("Nom d'utilisateur deja utilise");
    }
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    if (await this.users.existsByEmail(email)) {
      throw new ConflictException('Email deja enregistre');
    }
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; errno?: unknown };
  return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
}
