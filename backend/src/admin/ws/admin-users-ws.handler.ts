import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../../catalog/services/catalog.service';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { AdminUsersService } from '../services/admin-users.service';
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
    private readonly registry: GameRegistryService,
    private readonly notifications: NotificationService,
    private readonly catalog: CatalogService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async notifyCatalogInvalidated(adminId: number) {
    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();

    await Promise.all(
      ids.map((u) =>
        this.notifications.notifyUser(u.id, 'catalog.invalidate', {
          byUserId: adminId,
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }

  async usersList(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminListUsersWsDto, payload);
    const result = await this.users.list(dto as any);
    return { type: 'admin.users.list', payload: result };
  }

  async usersGet(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const user = await this.users.get(dto.id);
    return { type: 'admin.users.get', payload: { user } };
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
    return { type: 'admin.users.ban', payload: res };
  }

  async usersUnban(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.users.unban(dto.id);
    return { type: 'admin.users.unban', payload: res };
  }

  async usersDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.users.delete(dto.id);
    return { type: 'admin.users.delete', payload: res };
  }

  async usersUpdateRoles(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminUserRolesWsDto, payload);
    const user = await this.users.update(dto.id, { roles: dto.roles });
    await this.catalog.clearCache();
    this.registry.invalidateCache();
    await this.notifyCatalogInvalidated(admin.id);
    return { type: 'admin.users.rolesUpdated', payload: { user } };
  }
}

