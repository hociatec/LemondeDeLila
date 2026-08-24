import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../ports/admin-user.repository';
import type {
  AdminSafeUser,
  AdminUser,
} from '../../../domain/models/admin-user.model';
import type {
  CreateAdminUserCommand,
  UpdateAdminUserCommand,
} from './admin-users.commands';
import { AdminUserBanPolicyService } from './admin-user-ban-policy.service';
import { AdminUserPasswordService } from './admin-user-password.service';

@Injectable()
export class AdminUsersCommandService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: AdminUserRepository,
    private readonly passwords: AdminUserPasswordService,
    private readonly bans: AdminUserBanPolicyService,
  ) {}

  async create(body: CreateAdminUserCommand) {
    const email = body.email.toLowerCase();
    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(body.username);

    const password =
      body.password?.trim() || this.passwords.generateTemporaryPassword();
    const hash = await this.passwords.hashPassword(password);
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

  async update(
    id: number,
    body: UpdateAdminUserCommand,
  ): Promise<AdminSafeUser> {
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
          : this.bans.sanitizeReason(body.banReason);
    }
    if (body.avatar !== undefined) {
      user.avatar = body.avatar;
    }
    if (body.emailVerified !== undefined) {
      user.emailVerified = body.emailVerified;
    }
    if (body.password !== undefined) {
      const password = body.password.trim();
      if (!password) {
        throw new BadRequestException('Le mot de passe ne peut pas être vide');
      }
      user.password = await this.passwords.hashPassword(password);
    }

    const saved = await this.users.save(user);
    return this.omitPassword(saved);
  }

  async resetPassword(id: number) {
    const user = await this.requireUser(id);
    const password = this.passwords.generateTemporaryPassword();
    user.password = await this.passwords.hashPassword(password);
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
    user.bannedUntil = this.bans.resolveBannedUntil(durationDays, bannedUntil);
    user.banReason = this.bans.sanitizeReason(reason);
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

  private omitPassword(user: AdminUser): AdminSafeUser {
    const { password, ...safe } = user;
    void password;
    return safe;
  }
}
