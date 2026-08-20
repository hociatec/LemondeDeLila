import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../../../user/entities/user.entity';
import type {
  AdminUserRepository,
  ListAdminUsersFilters,
} from '../../../../application/ports/admin-user.repository';
import type { AdminSafeUser, AdminUser } from '../../../../domain/models/admin-user.model';

@Injectable()
export class AdminUserTypeormRepository implements AdminUserRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async clearExpiredBans(now: Date): Promise<void> {
    await this.users
      .createQueryBuilder()
      .update(User)
      .set({ bannedUntil: null, banReason: null })
      .where('banned_until IS NOT NULL AND banned_until <= :now', { now })
      .execute();
  }

  async clearExpiredChatBans(now: Date): Promise<void> {
    await this.users
      .createQueryBuilder()
      .update(User)
      .set({ chatBannedUntil: null, chatBanReason: null })
      .where('chat_banned_until IS NOT NULL AND chat_banned_until <= :now', {
        now,
      })
      .execute();
  }

  async list(
    filters: ListAdminUsersFilters,
  ): Promise<{ items: AdminSafeUser[]; total: number }> {
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
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (filters.search) {
      const q = `%${filters.search.trim()}%`;
      qb.andWhere('(user.email LIKE :q OR user.username LIKE :q)', { q });
    }
    if (filters.role) {
      qb.andWhere('JSON_CONTAINS(user.roles, :role, "$") = 1', {
        role: `"${filters.role}"`,
      });
    }

    const now = new Date();
    if (filters.status === 'active') {
      qb.andWhere('(user.banned_until IS NULL OR user.banned_until <= :now)', {
        now,
      });
    } else if (filters.status === 'banned') {
      qb.andWhere('user.banned_until > :now', { now });
    }

    if (filters.createdAfter) {
      qb.andWhere('user.created_at >= :after', { after: filters.createdAfter });
    }
    if (filters.createdBefore) {
      qb.andWhere('user.created_at <= :before', {
        before: filters.createdBefore,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((item) => this.toSafeModel(item)),
      total,
    };
  }

  async findById(id: number): Promise<AdminUser | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? this.toModel(user) : null;
  }

  async findSafeById(id: number): Promise<AdminSafeUser | null> {
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
    return user ? this.toSafeModel(user) : null;
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const user = await this.users.findOne({ where: { email } });
    return user ? this.toModel(user) : null;
  }

  async findByUsername(username: string): Promise<AdminUser | null> {
    const user = await this.users.findOne({ where: { username } });
    return user ? this.toModel(user) : null;
  }

  async create(data: Omit<AdminUser, 'id' | 'createdAt'>): Promise<AdminUser> {
    const entity = this.users.create({
      email: data.email,
      username: data.username,
      password: data.password ?? '',
      avatar: data.avatar,
      roles: data.roles,
      emailVerified: data.emailVerified,
      bannedUntil: data.bannedUntil,
      banReason: data.banReason,
      chatBannedUntil: data.chatBannedUntil,
      chatBanReason: data.chatBanReason,
    });
    const saved = await this.users.save(entity);
    return this.toModel(saved);
  }

  async save(user: AdminUser): Promise<AdminUser> {
    const saved = await this.users.save({
      id: user.id,
      email: user.email,
      username: user.username,
      password: user.password,
      avatar: user.avatar,
      roles: user.roles,
      emailVerified: user.emailVerified,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      chatBannedUntil: user.chatBannedUntil,
      chatBanReason: user.chatBanReason,
      createdAt: user.createdAt ?? undefined,
    });
    return this.toModel(saved);
  }

  async delete(id: number): Promise<void> {
    await this.users.delete(id);
  }

  private toSafeModel(user: User): AdminSafeUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar ?? null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      emailVerified: Boolean(user.emailVerified),
      bannedUntil: user.bannedUntil ?? null,
      banReason: user.banReason ?? null,
      chatBannedUntil: user.chatBannedUntil ?? null,
      chatBanReason: user.chatBanReason ?? null,
      createdAt: user.createdAt ?? null,
    };
  }

  private toModel(user: User): AdminUser {
    return {
      ...this.toSafeModel(user),
      password: user.password,
    };
  }
}
