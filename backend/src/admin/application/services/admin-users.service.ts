import { Injectable } from '@nestjs/common';
import type {
  CreateAdminUserCommand,
  ListAdminUsersQuery,
  UpdateAdminUserCommand,
} from '../use-cases/admin-users/admin-users.commands';
import {
  AdminUsersQueryService,
  type SafeUser,
} from '../use-cases/admin-users/admin-users-query.service';
import { AdminUsersCommandService } from '../use-cases/admin-users/admin-users-command.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly queries: AdminUsersQueryService,
    private readonly commands: AdminUsersCommandService,
  ) {}

  async list(query: ListAdminUsersQuery) {
    return this.queries.list(query);
  }

  async get(id: number): Promise<SafeUser> {
    return this.queries.get(id);
  }

  async create(body: CreateAdminUserCommand) {
    return this.commands.create(body);
  }

  async update(id: number, body: UpdateAdminUserCommand): Promise<SafeUser> {
    return this.commands.update(id, body);
  }

  async resetPassword(id: number) {
    return this.commands.resetPassword(id);
  }

  async ban(
    id: number,
    reason: string,
    durationDays?: number,
    bannedUntil?: string | null,
  ) {
    return this.commands.ban(id, reason, durationDays, bannedUntil);
  }

  async unban(id: number) {
    return this.commands.unban(id);
  }

  async delete(id: number) {
    return this.commands.delete(id);
  }
}
