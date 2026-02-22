import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import {
  getJwtAlgorithm,
  requireJwtSigningKey,
} from '../../common/auth/jwt-config';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);
  private readonly jwtSigningKey: string;
  private readonly jwtAlgorithm: jwt.Algorithm;
  private readonly jwtExpiresIn: jwt.SignOptions['expiresIn'];
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string | undefined;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {
    this.jwtSigningKey = requireJwtSigningKey(this.config);
    this.jwtAlgorithm = getJwtAlgorithm(this.config);
    this.jwtExpiresIn = this.config.get<jwt.SignOptions['expiresIn']>(
      'JWT_EXPIRES_IN',
      '12h',
    );
    this.jwtIssuer = this.config.get<string>('JWT_ISSUER', 'le-monde-de-lila');
    const aud = this.config.get<string>('JWT_AUDIENCE');
    this.jwtAudience = aud && aud.trim() ? aud.trim() : undefined;
  }

  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    await this.ensureUsernameAvailable(username);
    await this.ensureEmailAvailable(normalizedEmail);

    if (!password || password.trim() === '') {
      throw new BadRequestException('Mot de passe requis');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = this.users.create({
      email: normalizedEmail,
      username,
      password: hash,
      roles: [],
      avatar: null,
      emailVerified: true, // pas de workflow email pour l’instant
    });
    await this.users.save(user);
  }

  async login(username: string, password: string): Promise<{ token: string }> {
    const user = await this.users.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    const hash = user.password || '';
    const normalizedHash = hash.startsWith('$2y$')
      ? '$2b$' + hash.substring(4)
      : hash;

    let ok = false;
    try {
      ok = await bcrypt.compare(password, normalizedHash);
    } catch (err) {
      // En cas de hash invalide ou corruption, on log et on renvoie 401 générique
      this.logger.error(
        'Erreur bcrypt.compare',
        err instanceof Error ? err.stack : String(err),
      );
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!ok) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email non vérifié');
    }

    // Auto-unban: si la date de ban est passée, nettoyer les champs pour que l'admin ne voie plus "banni".
    if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
      user.bannedUntil = null;
      user.banReason = null;
      try {
        await this.users.save(user);
      } catch {
        // best-effort: don't block login for a cleanup failure
      }
    }
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      const until = formatDateFr(user.bannedUntil);
      const banReason = this.sanitizeBanReason(user.banReason);
      const reason = banReason ? ` (motif : ${banReason})` : '';
      throw new UnauthorizedException(
        `Compte banni jusqu'au ${until}${reason}`,
      );
    }

    const token = jwt.sign(
      {
        username: user.username,
        roles: user.roles?.length ? user.roles : ['ROLE_USER'],
        email: user.email,
        id: user.id,
      },
      this.jwtSigningKey,
      (() => {
        const options: jwt.SignOptions = {
          algorithm: this.jwtAlgorithm,
          expiresIn: this.jwtExpiresIn,
          issuer: this.jwtIssuer,
          subject: String(user.id),
        };
        if (this.jwtAudience) {
          options.audience = this.jwtAudience;
        }
        return options;
      })(),
    );
    return { token };
  }

  private readonly _banReasonWhitespace = /\s+/g;
  private sanitizeBanReason(reason: string | null | undefined): string | null {
    if (!reason) return null;
    const normalized = String(reason)
      .replace(this._banReasonWhitespace, ' ')
      .trim();
    return normalized ? normalized : null;
  }

  private async ensureUsernameAvailable(username: string): Promise<void> {
    const reserved = [
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
    ];
    if (reserved.includes(username.toLowerCase())) {
      throw new BadRequestException('Ce nom d’utilisateur est réservé');
    }
    const exists = await this.users.findOne({ where: { username } });
    if (exists) {
      throw new ConflictException('Nom d’utilisateur déjà utilisé');
    }
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const exists = await this.users.findOne({ where: { email } });
    if (exists) {
      throw new ConflictException('Email déjà enregistré');
    }
  }
}

function formatDateFr(date: Date): string {
  // Use UTC date to avoid timezone shifting in display.
  const iso = date.toISOString().slice(0, 10); // yyyy-MM-dd
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
