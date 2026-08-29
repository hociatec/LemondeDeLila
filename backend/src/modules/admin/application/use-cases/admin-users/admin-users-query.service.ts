import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../ports/admin-user.repository';
import type { AdminSafeUser } from '../../../domain/models/admin-user.model';
import type { ListAdminUsersQuery } from './admin-users.commands';

@Injectable()
export class AdminUsersQueryService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: AdminUserRepository,
  ) {}

  async list(query: ListAdminUsersQuery) {
    const now = new Date();
    await this.users.clearExpiredBans(now);
    await this.users.clearExpiredChatBans(now);

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const result = await this.users.list({
      search: query.search,
      role: query.role,
      status: query.status ?? 'all',
      createdAfter: this.parseOptionalDate(query.createdAfter),
      createdBefore: this.parseOptionalDate(query.createdBefore),
      page,
      limit,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async get(id: number): Promise<AdminSafeUser> {
    const now = new Date();
    await this.users.clearExpiredBans(now);
    await this.users.clearExpiredChatBans(now);

    const user = await this.users.findSafeById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private parseOptionalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
