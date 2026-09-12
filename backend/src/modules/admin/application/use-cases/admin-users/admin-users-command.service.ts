import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mapUniqueConstraintViolation } from '../../../../../platform/database/public-api';
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
import {
  normalizeEmail,
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../../../../user/public-api';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';

@Injectable()
export class AdminUsersCommandService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: Pick<
      AdminUserRepository,
      | 'create'
      | 'delete'
      | 'findByEmail'
      | 'findById'
      | 'findByUsername'
      | 'save'
    >,
    private readonly passwords: AdminUserPasswordService,
    private readonly bans: AdminUserBanPolicyService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async create(body: CreateAdminUserCommand) {
    validateCredentials(body.email, body.username);
    validateRoles(body.roles);
    validateAvatar(body.avatar);
    if (body.password !== undefined && typeof body.password !== 'string') {
      throw new BadRequestException('Mot de passe invalide');
    }
    if (
      body.password !== undefined &&
      body.password.length > PASSWORD_MAX_LENGTH
    ) {
      throw new BadRequestException('Mot de passe invalide');
    }
    const email = normalizeEmail(body.email);
    const username = normalizeUsername(body.username);
    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(username);

    const password =
      body.password?.trim() || this.passwords.generateTemporaryPassword();
    const hash = await this.passwords.hashPassword(password);
    const roles = body.roles?.length ? body.roles : ['ROLE_USER'];

    const saved = await this.mapUniquenessConflict(() =>
      this.users.create({
        email,
        username,
        password: hash,
        roles,
        avatar: body.avatar ?? null,
        bannedUntil: null,
        banReason: null,
        chatBannedUntil: null,
        chatBanReason: null,
      }),
    );

    return {
      user: this.omitPassword(saved),
      temporaryPassword: body.password ? undefined : password,
    };
  }

  async update(
    id: number,
    body: UpdateAdminUserCommand,
  ): Promise<AdminSafeUser> {
    assertSafeUserId(id);
    if (body.email !== undefined && typeof body.email !== 'string') {
      throw new BadRequestException('Email invalide');
    }
    if (body.username !== undefined && typeof body.username !== 'string') {
      throw new BadRequestException("Nom d'utilisateur invalide");
    }
    if (body.password !== undefined && typeof body.password !== 'string') {
      throw new BadRequestException('Mot de passe invalide');
    }
    const user = await this.requireUser(id);

    if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
      if (body.email.length > 320) {
        throw new BadRequestException('Email invalide');
      }
      const email = normalizeEmail(body.email);
      await this.ensureEmailAvailable(email, id);
      user.email = email;
    }
    if (body.username && body.username !== user.username) {
      validateUsername(body.username);
      const username = normalizeUsername(body.username);
      await this.ensureUsernameAvailable(username, id);
      user.username = username;
    }
    if (body.roles) {
      validateRoles(body.roles);
      user.roles = body.roles;
    }
    if (body.bannedUntil !== undefined) {
      user.bannedUntil =
        body.bannedUntil === null
          ? null
          : this.bans.resolveBannedUntil(
              this.clock.now(),
              undefined,
              body.bannedUntil,
            );
    }
    if (body.banReason !== undefined) {
      user.banReason =
        body.banReason === null || body.banReason === undefined
          ? null
          : this.bans.sanitizeReason(body.banReason);
    }
    if (body.avatar !== undefined) {
      validateAvatar(body.avatar);
      user.avatar = body.avatar;
    }
    if (body.password !== undefined) {
      const password = body.password.trim();
      if (!password) {
        throw new BadRequestException('Le mot de passe ne peut pas être vide');
      }
      if (password.length > PASSWORD_MAX_LENGTH) {
        throw new BadRequestException('Mot de passe invalide');
      }
      user.password = await this.passwords.hashPassword(password);
    }

    const saved = await this.mapUniquenessConflict(() => this.users.save(user));
    return this.omitPassword(saved);
  }

  async resetPassword(id: number) {
    assertSafeUserId(id);
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
    assertSafeUserId(id);
    const user = await this.requireUser(id);
    user.bannedUntil = this.bans.resolveBannedUntil(
      this.clock.now(),
      durationDays,
      bannedUntil,
    );
    user.banReason = this.bans.sanitizeReason(reason);
    const saved = await this.users.save(user);
    return { user: this.omitPassword(saved) };
  }

  async unban(id: number) {
    assertSafeUserId(id);
    const user = await this.requireUser(id);
    user.bannedUntil = null;
    user.banReason = null;
    const saved = await this.users.save(user);
    return { user: this.omitPassword(saved) };
  }

  async delete(id: number) {
    assertSafeUserId(id);
    await this.requireUser(id);
    await this.users.delete(id);
    return { deleted: true };
  }

  private async requireUser(id: number): Promise<AdminUser> {
    assertSafeUserId(id);
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

  private async mapUniquenessConflict<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    return mapUniqueConstraintViolation(
      operation,
      () => new ConflictException('Email ou nom utilisateur déjà utilisé'),
    );
  }
}

function assertSafeUserId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new BadRequestException('Identifiant utilisateur invalide');
  }
}

function validateCredentials(email: unknown, username: unknown): void {
  if (
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    email.length > 320
  ) {
    throw new BadRequestException('Email invalide');
  }
  validateUsername(username);
}

function validateUsername(username: unknown): void {
  if (
    typeof username !== 'string' ||
    username.trim().length < USERNAME_MIN_LENGTH ||
    username.trim().length > USERNAME_MAX_LENGTH
  ) {
    throw new BadRequestException("Nom d'utilisateur invalide");
  }
}

function validateRoles(roles: string[] | undefined): void {
  if (roles === undefined) return;
  if (
    !Array.isArray(roles) ||
    roles.length > 32 ||
    roles.some(
      (role) =>
        typeof role !== 'string' ||
        role.trim().length === 0 ||
        role.length > 64,
    )
  ) {
    throw new BadRequestException('Rôles invalides');
  }
}

function validateAvatar(avatar: string | null | undefined): void {
  if (avatar !== undefined && avatar !== null && avatar.length > 2048) {
    throw new BadRequestException('Avatar invalide');
  }
}
