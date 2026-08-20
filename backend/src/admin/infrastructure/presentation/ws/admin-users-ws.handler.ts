import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminUsersService } from '../../../application/services/admin-users.service';
import { AdminCatalogInvalidationService } from '../../../application/services/admin-catalog-invalidation.service';
import type { AdminListUsersDto } from '../http/dto/admin-list-users.dto';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import {
  AdminBanUserWsDto,
  AdminListUsersWsDto,
  AdminUserIdWsDto,
  AdminUserRolesWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminUsersWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly users: AdminUsersService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
  ) {}

  async usersList(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminListUsersWsDto, payload);
    const query: AdminListUsersDto = {
      search: dto.search,
      role: dto.role,
      status: dto.status ?? 'all',
      createdAfter: dto.createdAfter,
      createdBefore: dto.createdBefore,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    };
    const result = await this.users.list(query);
    return { type: WS_EVENTS.admin.users.list, payload: result };
  }

  async usersGet(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const user = await this.users.get(dto.id);
    return { type: WS_EVENTS.admin.users.get, payload: { user } };
  }

  async usersBan(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBanUserWsDto, payload);
    const res = await this.users.ban(
      dto.id,
      dto.reason,
      dto.durationDays,
      dto.bannedUntil ?? null,
    );
    return { type: WS_EVENTS.admin.users.ban, payload: res };
  }

  async usersUnban(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.users.unban(dto.id);
    return { type: WS_EVENTS.admin.users.unban, payload: res };
  }

  async usersDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.users.delete(dto.id);
    return { type: WS_EVENTS.admin.users.delete, payload: res };
  }

  async usersUpdateRoles(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminUserRolesWsDto, payload);
    const user = await this.users.update(dto.id, { roles: dto.roles });
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: WS_EVENTS.admin.users.rolesUpdated, payload: { user } };
  }
}





