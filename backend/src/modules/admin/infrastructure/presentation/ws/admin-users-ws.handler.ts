import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import type { ListAdminUsersQuery } from '../../../application/use-cases/admin-users/admin-users.commands';
import { AdminUserRolesUpdateService } from '../../../application/use-cases/admin-users/admin-user-roles-update.service';
import { AdminUsersCommandService } from '../../../application/use-cases/admin-users/admin-users-command.service';
import { AdminUsersQueryService } from '../../../application/use-cases/admin-users/admin-users-query.service';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import {
  AdminBanUserWsDto,
  AdminListUsersWsDto,
  AdminUserIdWsDto,
  AdminUserRolesWsDto,
} from './dto/admin-ws.dto';

@Injectable()
export class AdminUsersWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly usersQuery: AdminUsersQueryService,
    private readonly usersCommand: AdminUsersCommandService,
    private readonly userRolesUpdate: AdminUserRolesUpdateService,
  ) {}

  async usersList(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminListUsersWsDto, payload);
    const query: ListAdminUsersQuery = {
      search: dto.search,
      role: dto.role,
      status: dto.status ?? 'all',
      createdAfter: dto.createdAfter,
      createdBefore: dto.createdBefore,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    };
    const result = await this.usersQuery.list(query);
    return { type: WS_EVENTS.admin.users.list, payload: result };
  }

  async usersGet(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const user = await this.usersQuery.get(dto.id);
    return { type: WS_EVENTS.admin.users.get, payload: { user } };
  }

  async usersBan(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBanUserWsDto, payload);
    const res = await this.usersCommand.ban(
      dto.id,
      dto.reason,
      dto.durationDays,
      dto.bannedUntil ?? null,
    );
    return { type: WS_EVENTS.admin.users.ban, payload: res };
  }

  async usersUnban(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.usersCommand.unban(dto.id);
    return { type: WS_EVENTS.admin.users.unban, payload: res };
  }

  async usersDelete(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.usersCommand.delete(dto.id);
    return { type: WS_EVENTS.admin.users.delete, payload: res };
  }

  async usersUpdateRoles(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminUserRolesWsDto, payload);
    const user = await this.userRolesUpdate.updateRoles(
      admin.id,
      dto.id,
      dto.roles,
    );
    return { type: WS_EVENTS.admin.users.rolesUpdated, payload: { user } };
  }
}
