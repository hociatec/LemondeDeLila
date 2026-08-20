import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcryptImport from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../ports/admin-user.repository';
import type { AdminSafeUser, AdminUser } from '../../../domain/models/admin-user.model';
import type {
  CreateAdminUserCommand,
  UpdateAdminUserCommand,
} from './admin-users.commands';

type BcryptApi = {
  hash(input: string, rounds: number): Promise<string>;
};

const bcrypt = bcryptImport as unknown as BcryptApi;

@Injectable()
export class AdminUsersCommandService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: AdminUserRepository,
  ) {}

  async create(body: CreateAdminUserCommand) {
    const email = body.email.toLowerCase();
    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(body.username);

    const password = body.password?.trim() || this.generatePassword();
    const hash = await bcrypt.hash(password, 10);
    const roles = body.roles?.length ? body.roles : ['ROLE_USER'];

    const saved = await this.users.create({
      email,
      username: body.username,
      password: hash,
      roles,
      avatar: body.avatar ?? null,
      emailVerified: body.emailVerified ?? true,
      bannedUntil: null,
      banReason: null,
      chatBannedUntil: null,
      chatBanReason: null,
    });
    return {
      user: this.omitPassword(saved),
      temporaryPassword: body.password ? undefined : password,
    };
  }

  async update(id: number, body: UpdateAdminUserCommand): Promise<AdminSafeUser> {
    const user = await this.requireUser(id);
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
    return this.omitPassword(saved);
  }

  async resetPassword(id: number) {
    const user = await this.requireUser(id);
    const password = this.generatePassword();
    user.password = await bcrypt.hash(password, 10);
    const saved = await this.users.save(user);
    return { user: this.omitPassword(saved), temporaryPassword: password };
  }

  async ban(
    id: number,
    reason: string,
    durationDays?: number,
    bannedUntil?: string | null,
  ) {
    const user = await this.requireUser(id);
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
    const saved = await this.users.save(user);
    return { user: this.omitPassword(saved) };
  }

  async unban(id: number) {
    const user = await this.requireUser(id);
    user.bannedUntil = null;
    user.banReason = null;
    const saved = await this.users.save(user);
    return { user: this.omitPassword(saved) };
  }

  async delete(id: number) {
    await this.requireUser(id);
    await this.users.delete(id);
    return { deleted: true };
  }

  private async requireUser(id: number): Promise<AdminUser> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private async ensureEmailAvailable(email: string, excludeId?: number) {
    const existing = await this.users.findByEmail(email);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Email déjà utilisé');
    }
  }

  private async ensureUsernameAvailable(username: string, excludeId?: number) {
    const existing = await this.users.findByUsername(username);
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

  private omitPassword(user: AdminUser): AdminSafeUser {
    const { password, ...safe } = user;
    void password;
    return safe;
  }
}

function sanitizeBanReason(reason: string): string {
  const raw = (reason ?? '').toString();
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new BadRequestException('Motif requis');
  }
  return normalized.length > 255 ? normalized.substring(0, 255) : normalized;
}
