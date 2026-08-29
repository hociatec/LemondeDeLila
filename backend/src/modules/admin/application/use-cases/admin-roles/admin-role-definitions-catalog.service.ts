import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ROLE_DEFINITION_REPOSITORY,
  type RoleDefinitionRepository,
} from '../../ports/role-definition.repository';
import type { RoleDefinition } from '../../../domain/models/role-definition.model';
import {
  AdminRoleAlreadyExistsError,
  AdminRoleNotFoundError,
} from '../../../domain/errors/admin-domain.errors';

@Injectable()
export class AdminRoleDefinitionsCatalogService implements OnModuleInit {
  private cache: RoleDefinition[] | null = null;

  constructor(
    @Inject(ROLE_DEFINITION_REPOSITORY)
    private readonly roles: RoleDefinitionRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  async list(): Promise<RoleDefinition[]> {
    if (this.cache) {
      return this.cache;
    }

    await this.ensureSeeded();
    const all = await this.roles.findAll();
    const definitions = all.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    this.cache = definitions;
    return definitions;
  }

  async create(definition: RoleDefinition): Promise<void> {
    const current = await this.list();
    if (current.some((role) => role.name === definition.name)) {
      throw new AdminRoleAlreadyExistsError(definition.name);
    }
    await this.roles.insert({
      name: definition.name,
      description: definition.description,
      permissions: definition.permissions ?? [],
    });
    this.cache = null;
  }

  async update(
    name: string,
    update: Partial<RoleDefinition> & { name?: string },
  ): Promise<void> {
    await this.ensureSeeded();
    const current = await this.roles.findByName(name);
    if (!current) {
      throw new AdminRoleNotFoundError(name);
    }

    const nextName = update.name ?? current.name;
    if (nextName !== name) {
      const existing = await this.roles.findByName(nextName);
      if (existing) {
        throw new AdminRoleAlreadyExistsError(nextName);
      }
    }

    await this.roles.update(name, {
      name: nextName,
      description: update.description ?? current.description,
      permissions: update.permissions ?? current.permissions ?? [],
    });
    this.cache = null;
  }

  async delete(name: string): Promise<void> {
    await this.ensureSeeded();
    const deleted = await this.roles.delete(name);
    if (!deleted) {
      throw new AdminRoleNotFoundError(name);
    }
    this.cache = null;
  }

  private getDefaultDefinitions(): RoleDefinition[] {
    return [
      {
        name: 'ROLE_USER',
        description:
          'Acces utilisateur standard, peut rejoindre et jouer aux parties.',
        permissions: ['game.play', 'game.history', 'chat.read'],
      },
      {
        name: 'ROLE_MODERATOR',
        description:
          'Peut gerer les utilisateurs (ban/unban) et surveiller les parties.',
        permissions: ['game.play', 'game.history', 'chat.read', 'admin.users'],
      },
      {
        name: 'ROLE_ADMIN',
        description:
          "Acces complet a l'administration, aux jeux et aux configurations.",
        permissions: ['admin.*', 'game.*', 'log.read'],
      },
    ];
  }

  private async ensureSeeded(): Promise<void> {
    const count = await this.roles.count();
    if (count > 0) {
      return;
    }

    const definitions = this.getDefaultDefinitions().filter(
      (definition) => definition?.name && definition?.description,
    );
    await this.roles.saveMany(definitions);
    this.cache = null;
  }
}
