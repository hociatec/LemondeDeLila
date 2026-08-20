import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminRolesService } from '../../../application/use-cases/admin-roles/admin-roles.service';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
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
    private readonly roles: AdminRolesService,
  ) {}

  async rolesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminRolesListWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.roles.list,
      payload: await this.roles.list(),
    };
  }

  async rolesDefinitionsList(session: WsSession) {
    requireAdmin(session);
    return {
      type: WS_EVENTS.admin.roles.definitions,
      payload: await this.roles.listDefinitions(),
    };
  }

  async roleDefinitionCreate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminRoleDefinitionCreateWsDto,
      payload,
    );
    return {
      type: WS_EVENTS.admin.roles.definitions,
      payload: await this.roles.create(admin.id, dto),
    };
  }

  async roleDefinitionUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminRoleDefinitionUpdateWsDto,
      payload,
    );
    return {
      type: WS_EVENTS.admin.roles.definitions,
      payload: await this.roles.update(admin.id, dto),
    };
  }

  async roleDefinitionDelete(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminRoleDefinitionDeleteWsDto,
      payload,
    );
    return {
      type: WS_EVENTS.admin.roles.definitions,
      payload: await this.roles.delete(admin.id, dto.name),
    };
  }
}





