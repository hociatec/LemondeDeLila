import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../../shared/interfaces/public-api';
import { businessMsToDate } from '@shared/utils/public-api';
import type {
  UserAdministrationFilters,
  UserAdministrationPort,
  UserAdministrationRecord,
  UserAdministrationSafeRecord,
} from '../../../../application/ports/user-administration.port';
import { User } from '../entities/user.entity';

@Injectable()
export class UserAdministrationTypeormRepository implements UserAdministrationPort {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  clearExpiredBans(now: Date): Promise<void> {
    return this.users
      .createQueryBuilder()
      .update(User)
      .set({ bannedUntil: null, banReason: null })
      .where('banned_until IS NOT NULL AND banned_until <= :now', { now })
      .execute()
      .then(() => undefined);
  }

  clearExpiredChatBans(now: Date): Promise<void> {
    return this.users
      .createQueryBuilder()
      .update(User)
      .set({ chatBannedUntil: null, chatBanReason: null })
      .where('chat_banned_until IS NOT NULL AND chat_banned_until <= :now', {
        now,
      })
      .execute()
      .then(() => undefined);
  }

  async *scanIdBatches(): AsyncIterable<readonly number[]> {
    const raw = await this.users
      .createQueryBuilder('user')
      .select('MAX(user.id)', 'maximum')
      .getRawOne<{ maximum: number | string | null }>();
    const maximum = Number(raw?.maximum ?? 0);
    if (!Number.isSafeInteger(maximum) || maximum < 0)
      throw new Error('Invalid user ID upper bound');
    let afterId = 0;
    while (afterId < maximum) {
      const rows = await this.users
        .createQueryBuilder('user')
        .select('user.id', 'id')
        .where('user.id > :afterId AND user.id <= :maximum', {
          afterId,
          maximum,
        })
        .orderBy('user.id', 'ASC')
        .limit(100)
        .getRawMany<{ id: number | string }>();
      if (rows.length === 0) return;
      const ids = rows.map((row) => Number(row.id));
      for (const id of ids) {
        if (!Number.isSafeInteger(id) || id <= afterId || id > maximum)
          throw new Error('Invalid user ID scan order');
        afterId = id;
      }
      yield ids;
    }
  }

  async list(
    filters: UserAdministrationFilters,
  ): Promise<{ items: UserAdministrationSafeRecord[]; total: number }> {
    const query = this.users
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.username',
        'user.avatar',
        'user.roles',
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
      const search = '%' + filters.search.trim() + '%';
      query.andWhere(
        '(user.email LIKE :search OR user.username LIKE :search)',
        { search },
      );
    }
    if (filters.role) {
      query.andWhere("JSON_CONTAINS(user.roles, :role, '$') = 1", {
        role: '"' + filters.role + '"',
      });
    }
    const now = businessMsToDate(this.clock.now());
    if (filters.status === 'active') {
      query.andWhere(
        '(user.banned_until IS NULL OR user.banned_until <= :now)',
        { now },
      );
    } else if (filters.status === 'banned') {
      query.andWhere('user.banned_until > :now', { now });
    }
    if (filters.createdAfter)
      query.andWhere('user.created_at >= :after', {
        after: filters.createdAfter,
      });
    if (filters.createdBefore)
      query.andWhere('user.created_at <= :before', {
        before: filters.createdBefore,
      });
    query.skip(filters.page * filters.limit).take(filters.limit);
    const [items, total] = await query.getManyAndCount();
    return { items: items.map((item) => this.toSafe(item)), total };
  }

  async findById(id: number): Promise<UserAdministrationRecord | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? this.toRecord(user) : null;
  }

  async findSafeById(id: number): Promise<UserAdministrationSafeRecord | null> {
    const user = await this.users.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        roles: true,
        bannedUntil: true,
        banReason: true,
        chatBannedUntil: true,
        chatBanReason: true,
        createdAt: true,
      },
    });
    return user ? this.toSafe(user) : null;
  }

  async findByEmail(email: string): Promise<UserAdministrationRecord | null> {
    const user = await this.users.findOne({ where: { email } });
    return user ? this.toRecord(user) : null;
  }

  async findByUsername(
    username: string,
  ): Promise<UserAdministrationRecord | null> {
    const user = await this.users.findOne({ where: { username } });
    return user ? this.toRecord(user) : null;
  }

  async create(
    data: Omit<UserAdministrationRecord, 'id' | 'createdAt'>,
  ): Promise<UserAdministrationRecord> {
    const saved = await this.users.save(
      this.users.create({
        email: data.email,
        username: data.username,
        password: data.password ?? '',
        avatar: data.avatar,
        roles: data.roles,
        bannedUntil: data.bannedUntil,
        banReason: data.banReason,
        chatBannedUntil: data.chatBannedUntil,
        chatBanReason: data.chatBanReason,
      }),
    );
    return this.toRecord(saved);
  }

  async save(
    data: UserAdministrationRecord,
  ): Promise<UserAdministrationRecord> {
    const saved = await this.users.save({
      id: data.id,
      email: data.email,
      username: data.username,
      password: data.password ?? undefined,
      avatar: data.avatar,
      roles: data.roles,
      bannedUntil: data.bannedUntil,
      banReason: data.banReason,
      chatBannedUntil: data.chatBannedUntil,
      chatBanReason: data.chatBanReason,
      createdAt: data.createdAt ?? undefined,
    });
    return this.toRecord(saved);
  }

  delete(id: number): Promise<void> {
    return this.users.delete(id).then(() => undefined);
  }

  private toSafe(user: User): UserAdministrationSafeRecord {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar ?? null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      bannedUntil: user.bannedUntil ?? null,
      banReason: user.banReason ?? null,
      chatBannedUntil: user.chatBannedUntil ?? null,
      chatBanReason: user.chatBanReason ?? null,
      createdAt: user.createdAt ?? null,
    };
  }

  private toRecord(user: User): UserAdministrationRecord {
    return { ...this.toSafe(user), password: user.password };
  }
}
