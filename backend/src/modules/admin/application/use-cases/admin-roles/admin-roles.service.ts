import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminCatalogInvalidationService } from '../../services/admin-catalog-invalidation.service';
import { AdminRoleDefinitionsCatalogService } from './admin-role-definitions-catalog.service';

@Injectable()
export class AdminRolesService {
  constructor(
    private readonly roleDefinitions: AdminRoleDefinitionsCatalogService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
  ) {}

  async list() {
    const definitions = await this.roleDefinitions.list();
    return {
      roles: definitions.map((definition) => definition.name),
      definitions,
    };
  }

  async listDefinitions() {
    const definitions = await this.roleDefinitions.list();
    return { definitions };
  }

  async create(
    adminId: number,
    input: {
      name: string;
      description: string;
      permissions: string[];
    },
  ) {
    assertAdminId(adminId);
    await this.roleDefinitions.create({
      name: input.name,
      description: input.description,
      permissions: input.permissions,
    });
    await this.catalogInvalidation.notifyCatalogInvalidated(adminId);
    return this.listDefinitions();
  }

  async update(
    adminId: number,
    input: {
      name: string;
      newName?: string;
      description?: string;
      permissions?: string[];
    },
  ) {
    assertAdminId(adminId);
    await this.roleDefinitions.update(input.name, {
      name: input.newName,
      description: input.description,
      permissions: input.permissions,
    });
    await this.catalogInvalidation.notifyCatalogInvalidated(adminId);
    return this.listDefinitions();
  }

  async delete(adminId: number, name: string) {
    assertAdminId(adminId);
    await this.roleDefinitions.delete(name);
    await this.catalogInvalidation.notifyCatalogInvalidated(adminId);
    return this.listDefinitions();
  }
}

function assertAdminId(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException('Identifiant administrateur invalide');
  }
}
