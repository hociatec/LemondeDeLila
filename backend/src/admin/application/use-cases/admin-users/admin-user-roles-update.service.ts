import { Injectable } from '@nestjs/common';
import type { AdminSafeUser } from '../../../../domain/models/admin-user.model';
import { AdminCatalogInvalidationService } from '../../services/admin-catalog-invalidation.service';
import { AdminUsersCommandService } from './admin-users-command.service';

@Injectable()
export class AdminUserRolesUpdateService {
  constructor(
    private readonly commands: AdminUsersCommandService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
  ) {}

  async updateRoles(
    adminId: number,
    userId: number,
    roles: string[],
  ): Promise<AdminSafeUser> {
    const user = await this.commands.update(userId, { roles });
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return user;
  }
}
