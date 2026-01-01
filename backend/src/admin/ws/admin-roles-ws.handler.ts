import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
import { RoleDefinitionsService } from '../services/role-definitions.service';
import {
  AdminRoleDefinitionCreateWsDto,
  AdminRoleDefinitionDeleteWsDto,
  AdminRoleDefinitionUpdateWsDto,
  AdminRolesListWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminRolesWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly roleDefinitions: RoleDefinitionsService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
  ) {}

  async rolesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminRolesListWsDto, payload ?? {});
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.list',
      payload: {
        roles: definitions.map((d) => d.name),
        definitions,
      },
    };
  }

  async rolesDefinitionsList(session: WsSession) {
    requireAdmin(session);
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.definitions',
      payload: { definitions },
    };
  }

  async roleDefinitionCreate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminRoleDefinitionCreateWsDto, payload);
    await this.roleDefinitions.create({
      name: dto.name,
      description: dto.description,
      permissions: dto.permissions,
    });
    await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
    return this.rolesDefinitionsList(session);
  }

  async roleDefinitionUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminRoleDefinitionUpdateWsDto, payload);
    await this.roleDefinitions.update(dto.name, {
      name: dto.newName,
      description: dto.description,
      permissions: dto.permissions,
    });
    await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
    return this.rolesDefinitionsList(session);
  }

  async roleDefinitionDelete(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminRoleDefinitionDeleteWsDto, payload);
    await this.roleDefinitions.delete(dto.name);
    await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
    return this.rolesDefinitionsList(session);
  }
}

