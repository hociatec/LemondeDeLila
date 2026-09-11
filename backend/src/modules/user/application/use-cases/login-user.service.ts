import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from '../ports/password-hasher.port';
import {
  USER_TOKEN_SERVICE,
  type UserTokenServicePort,
} from '../ports/user-token.port';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenServicePort,
} from '../ports/refresh-token.port';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';
import {
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '../../domain/policies/user-credentials.policy';
import { userBanStatus } from '../../domain/policies/user-ban.policy';

@Injectable()
export class LoginUserService {
  private readonly logger = new Logger(LoginUserService.name);
  private readonly banReasonWhitespace = /\s+/g;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(USER_TOKEN_SERVICE)
    private readonly tokenService: UserTokenServicePort,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenServicePort,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(input: { username: string; password: string }): Promise<{
    token: string;
    refreshToken: string;
    userId: number;
    username: string;
  }> {
    if (
      typeof input.username !== 'string' ||
      typeof input.password !== 'string' ||
      input.username.length > USERNAME_MAX_LENGTH ||
      input.password.length > PASSWORD_MAX_LENGTH
    ) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    const user = await this.users.findByUsername(
      normalizeUsername(input.username),
    );
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const hash = user.password || '';
    const normalizedHash = hash.startsWith('$2y$')
      ? '$2b$' + hash.substring(4)
      : hash;

    let ok: boolean;
    try {
      ok = await this.passwordHasher.compare(input.password, normalizedHash);
    } catch (err) {
      this.logger.error(
        'Erreur bcrypt.compare',
        err instanceof Error ? err.stack : String(err),
      );
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!ok) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    const banStatus = userBanStatus(user.bannedUntil, this.clock.now());
    if (banStatus === 'invalid')
      throw new UnauthorizedException('Compte banni');
    if (banStatus === 'expired') {
      user.bannedUntil = null;
      user.banReason = null;
      try {
        await this.users.save(user);
      } catch {
        // best effort
      }
    }
    if (banStatus === 'active' && user.bannedUntil) {
      const until = formatDateFr(user.bannedUntil);
      const reason = this.sanitizeBanReason(user.banReason);
      const suffix = reason ? ` (motif : ${reason})` : '';
      throw new UnauthorizedException(
        `Compte banni jusqu'au ${until}${suffix}`,
      );
    }

    const token = this.tokenService.sign({
      id: user.id,
      email: user.email,
      roles: user.roles?.length ? user.roles : ['ROLE_USER'],
      username: user.username,
    });
    const refreshToken = await this.refreshTokens.issue(user.id);
    return { token, refreshToken, userId: user.id, username: user.username };
  }

  private sanitizeBanReason(reason: string | null): string | null {
    if (!reason) {
      return null;
    }
    const normalized = String(reason)
      .replace(this.banReasonWhitespace, ' ')
      .trim();
    return normalized.slice(0, 255) || null;
  }
}

function formatDateFr(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
