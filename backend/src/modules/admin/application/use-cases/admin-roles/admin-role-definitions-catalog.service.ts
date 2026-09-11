import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
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
    if (all.length > MAX_ROLE_DEFINITIONS) {
      throw new BadRequestException('Trop de définitions de rôles.');
    }
    const definitions = all
      .map((definition) => normalizeRoleDefinition(definition))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    this.cache = definitions;
    return definitions;
  }

  async create(definition: RoleDefinition): Promise<void> {
    const normalized = normalizeRoleDefinition(definition);
    const current = await this.list();
    if (current.some((role) => role.name === normalized.name)) {
      throw new AdminRoleAlreadyExistsError(normalized.name);
    }
    await this.roles.insert(normalized);
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

    const nextName =
      update.name === undefined
        ? current.name
        : normalizeRoleName(update.name);
    if (nextName !== name) {
      const existing = await this.roles.findByName(nextName);
      if (existing) {
        throw new AdminRoleAlreadyExistsError(nextName);
      }
    }

    await this.roles.update(name, {
      name: nextName,
      description:
        update.description === undefined
          ? current.description
          : normalizeRoleDescription(update.description),
      permissions:
        update.permissions === undefined
          ? current.permissions
          : normalizeRolePermissions(update.permissions),
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

const MAX_ROLE_DEFINITIONS = 128;
const MAX_ROLE_NAME_LENGTH = 100;
const MAX_ROLE_DESCRIPTION_LENGTH = 255;
const MAX_ROLE_PERMISSIONS = 64;
const MAX_ROLE_PERMISSION_LENGTH = 100;

function normalizeRoleDefinition(definition: RoleDefinition): RoleDefinition {
  return {
    name: normalizeRoleName(definition?.name),
    description: normalizeRoleDescription(definition?.description),
    permissions: normalizeRolePermissions(definition?.permissions),
  };
}

function normalizeRoleName(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > MAX_ROLE_NAME_LENGTH) {
    throw new BadRequestException('Nom de rôle invalide.');
  }
  return normalized;
}

function normalizeRoleDescription(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > MAX_ROLE_DESCRIPTION_LENGTH) {
    throw new BadRequestException('Description de rôle trop longue.');
  }
  return normalized;
}

function normalizeRolePermissions(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ROLE_PERMISSIONS) {
    throw new BadRequestException('Permissions de rôle invalides.');
  }
  const permissions = value.map((permission) =>
    typeof permission === 'string' ? permission.trim() : '',
  );
  if (
    permissions.some(
      (permission) =>
        !permission || permission.length > MAX_ROLE_PERMISSION_LENGTH,
    )
  ) {
    throw new BadRequestException('Permissions de rôle invalides.');
  }
  return [...new Set(permissions)];
}
