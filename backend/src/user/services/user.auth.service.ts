import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';

@Injectable()
export class UserAuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret || !secret.trim()) {
      throw new Error(
        'JWT_SECRET doit être défini pour signer les tokens (voir .env).',
      );
    }
    this.jwtSecret = secret;
    this.jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN', '12h');
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
      console.error('Erreur bcrypt.compare', err);
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!ok) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email non vérifié');
    }
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      const until = user.bannedUntil.toISOString();
      const reason = user.banReason ? ` (motif : ${user.banReason})` : '';
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
      this.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: this.jwtExpiresIn,
        issuer: 'le-monde-de-lila',
        subject: String(user.id),
      },
    );
    return { token };
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
