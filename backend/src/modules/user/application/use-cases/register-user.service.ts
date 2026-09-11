import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { mapUniqueConstraintViolation } from '../../../../platform/database/public-api';
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from '../ports/password-hasher.port';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';
import {
  assertPasswordPolicy,
  normalizeEmail,
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
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
    if (
      typeof input.email !== 'string' ||
      typeof input.username !== 'string' ||
      typeof input.password !== 'string'
    ) {
      throw new BadRequestException('Identifiants invalides');
    }
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedUsername = normalizeUsername(input.username);
    if (
      normalizedUsername.length < USERNAME_MIN_LENGTH ||
      normalizedUsername.length > USERNAME_MAX_LENGTH ||
      normalizedEmail.length === 0 ||
      normalizedEmail.length > 320
    ) {
      throw new BadRequestException('Identifiants invalides');
    }
    await this.ensureUsernameAvailable(normalizedUsername);
    await this.ensureEmailAvailable(normalizedEmail);

    if (!input.password || input.password.trim() === '') {
      throw new BadRequestException('Mot de passe requis');
    }
    if (input.password.length > PASSWORD_MAX_LENGTH) {
      throw new BadRequestException('Mot de passe invalide');
    }
    try {
      assertPasswordPolicy(input.password);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Mot de passe invalide',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const avatar = input.avatar?.trim() || null;
    if (avatar && avatar.length > 2048) {
      throw new BadRequestException('Avatar invalide');
    }
    await mapUniqueConstraintViolation(
      () =>
        this.users.create({
          email: normalizedEmail,
          username: normalizedUsername,
          password: passwordHash,
          roles: [],
          avatar,
          preferences: null,
          bannedUntil: null,
          banReason: null,
          chatBannedUntil: null,
          chatBanReason: null,
        }),
      () => new ConflictException('Email ou nom utilisateur déjà utilisé'),
    );
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
