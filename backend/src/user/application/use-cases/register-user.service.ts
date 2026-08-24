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
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../ports/user.repository';

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
    const normalizedEmail = input.email.toLowerCase();
    await this.ensureUsernameAvailable(input.username);
    await this.ensureEmailAvailable(normalizedEmail);

    if (!input.password || input.password.trim() === '') {
      throw new BadRequestException('Mot de passe requis');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    await this.users.create({
      email: normalizedEmail,
      username: input.username,
      password: passwordHash,
      roles: [],
      avatar: input.avatar?.trim() ? input.avatar.trim() : null,
      preferences: null,
      emailVerified: true,
      bannedUntil: null,
      banReason: null,
      chatBannedUntil: null,
      chatBanReason: null,
    });
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
    if (this.reserved.has(username.toLowerCase())) {
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
