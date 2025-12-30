import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from '../../user/entities/user.entity';
import { AdminListUsersDto } from '../dto/admin-list-users.dto';
import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(query: AdminListUsersDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const qb = this.users
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.username',
        'user.avatar',
        'user.roles',
        'user.emailVerified',
        'user.bannedUntil',
        'user.banReason',
        'user.chatBannedUntil',
        'user.chatBanReason',
        'user.createdAt',
      ])
      .orderBy('user.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.search) {
      const q = `%${query.search.trim()}%`;
      qb.andWhere('(user.email LIKE :q OR user.username LIKE :q)', { q });
    }
    const now = new Date();
    if (query.role) {
      qb.andWhere('JSON_CONTAINS(user.roles, :role, "$") = 1', {
        role: `"${query.role}"`,
      });
    }
    if (query.status === 'active') {
      qb.andWhere('(user.banned_until IS NULL OR user.banned_until <= :now)', {
        now,
      });
    } else if (query.status === 'banned') {
      qb.andWhere('user.banned_until > :now', { now });
    }
    if (query.createdAfter) {
      const after = new Date(query.createdAfter);
      if (!Number.isNaN(after.getTime())) {
        qb.andWhere('user.created_at >= :after', { after });
      }
    }
    if (query.createdBefore) {
      const before = new Date(query.createdBefore);
      if (!Number.isNaN(before.getTime())) {
        qb.andWhere('user.created_at <= :before', { before });
      }
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async get(id: number): Promise<SafeUser> {
    const user = await this.users.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'username',
        'avatar',
        'roles',
        'emailVerified',
        'bannedUntil',
        'banReason',
        'chatBannedUntil',
        'chatBanReason',
        'createdAt',
      ],
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  async create(body: AdminCreateUserDto) {
    const email = body.email.toLowerCase();
    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(body.username);

    const password = body.password?.trim() || this.generatePassword();
    const hash = await bcrypt.hash(password, 10);
    const roles = body.roles?.length ? body.roles : ['ROLE_USER'];

    const user = this.users.create({
      email,
      username: body.username,
      password: hash,
      roles,
      avatar: body.avatar ?? null,
      emailVerified: body.emailVerified ?? true,
    });
    const saved = await this.users.save(user);
    const { password: _, ...safe } = saved;
    return {
      user: safe,
      temporaryPassword: body.password ? undefined : password,
    };
  }

  async update(id: number, body: AdminUpdateUserDto): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
      await this.ensureEmailAvailable(body.email.toLowerCase(), id);
      user.email = body.email.toLowerCase();
    }
    if (body.username && body.username !== user.username) {
      await this.ensureUsernameAvailable(body.username, id);
      user.username = body.username;
    }
    if (body.roles) {
      user.roles = body.roles;
    }
    if (body.bannedUntil !== undefined) {
      user.bannedUntil = body.bannedUntil ? new Date(body.bannedUntil) : null;
    }
    if (body.banReason !== undefined) {
      user.banReason =
        body.banReason === null || body.banReason === undefined
          ? null
          : sanitizeBanReason(body.banReason);
    }
    if (body.avatar !== undefined) {
      user.avatar = body.avatar;
    }
    if (body.emailVerified !== undefined) {
      user.emailVerified = body.emailVerified;
    }
    if (body.password) {
      if (!body.password.trim()) {
        throw new BadRequestException('Mot de passe vide');
      }
      user.password = await bcrypt.hash(body.password, 10);
    }
    const saved = await this.users.save(user);
    const { password: _, ...safe } = saved;
    return safe;
  }

  async resetPassword(id: number) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const password = this.generatePassword();
    user.password = await bcrypt.hash(password, 10);
    await this.users.save(user);
    const { password: _, ...safe } = user;
    return { user: safe, temporaryPassword: password };
  }

  async ban(
    id: number,
    reason: string,
    durationDays?: number,
    bannedUntil?: string | null,
  ) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Motif requis');
    }
    let until: Date | null = null;
    if (bannedUntil) {
      const parsed = new Date(bannedUntil);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Date de fin invalide');
      }
      until = parsed;
    } else if (durationDays && durationDays > 0) {
      until = new Date();
      until.setDate(until.getDate() + durationDays);
    } else {
      throw new BadRequestException('Durée ou date de fin requise');
    }
    user.bannedUntil = until;
    user.banReason = sanitizeBanReason(reason);
    await this.users.save(user);
    const { password: _, ...safe } = user;
    return { user: safe };
  }

  async unban(id: number) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    user.bannedUntil = null;
    user.banReason = null;
    const saved = await this.users.save(user);
    const { password: _, ...safe } = saved;
    return { user: safe };
  }

  async delete(id: number) {
    const existing = await this.users.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    await this.users.delete(id);
    return { deleted: true };
  }

  private async ensureEmailAvailable(email: string, excludeId?: number) {
    const existing = await this.users.findOne({ where: { email } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Email déjà utilisé');
    }
  }

  private async ensureUsernameAvailable(username: string, excludeId?: number) {
    const existing = await this.users.findOne({ where: { username } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException("Nom d'utilisateur déjà utilisé");
    }
  }

  private generatePassword(): string {
    return randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10);
  }
}

function sanitizeBanReason(reason: string): string {
  const raw = (reason ?? '').toString();
  // Évite les retours à la ligne / tabs qui cassent l'affichage client.
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new BadRequestException('Motif requis');
  }
  // Colonne SQL: varchar(255)
  return normalized.length > 255 ? normalized.substring(0, 255) : normalized;
}
