import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleDefinitionEntity } from '../../infrastructure/persistence/typeorm/entities/role-definition.entity';
import type { RoleDefinition } from '../../domain/models/role-definition.model';

@Injectable()
export class RoleDefinitionsService implements OnModuleInit {
  private cache: RoleDefinition[] | null = null;

  constructor(
    @InjectRepository(RoleDefinitionEntity)
    private readonly repo: Repository<RoleDefinitionEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  async list(): Promise<RoleDefinition[]> {
    if (this.cache) {
      return this.cache;
    }

    await this.ensureSeeded();
    const all = await this.repo.find();
    const definitions = all
      .map((row) => ({
        name: row.name,
        description: row.description,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    this.cache = definitions;
    return definitions;
  }

  async create(definition: RoleDefinition): Promise<void> {
    const current = await this.list();
    if (current.some((role) => role.name === definition.name)) {
      throw new Error(`Le rôle '${definition.name}' existe déjà.`);
    }
    await this.repo.insert({
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
    const current = await this.repo.findOne({ where: { name } });
    if (!current) {
      throw new Error(`Rôle '${name}' introuvable.`);
    }
    const nextName = update.name ?? current.name;
    await this.repo.manager.transaction(async (manager) => {
      if (nextName !== name) {
        const existing = await manager.findOne(RoleDefinitionEntity, {
          where: { name: nextName },
        });
        if (existing) {
          throw new Error(`Le rôle '${nextName}' existe déjà.`);
        }
        await manager.delete(RoleDefinitionEntity, { name });
        await manager.insert(RoleDefinitionEntity, {
          name: nextName,
          description: update.description ?? current.description,
          permissions: update.permissions ?? current.permissions ?? [],
        });
        return;
      }
      await manager.update(
        RoleDefinitionEntity,
        { name },
        {
          description: update.description ?? current.description,
          permissions: update.permissions ?? current.permissions ?? [],
        },
      );
    });
    this.cache = null;
  }

  async delete(name: string): Promise<void> {
    await this.ensureSeeded();
    const result = await this.repo.delete({ name });
    if (!result.affected) {
      throw new Error(`Rôle '${name}' introuvable.`);
    }
    this.cache = null;
  }

  private getDefaultDefinitions(): RoleDefinition[] {
    return [
      {
        name: 'ROLE_USER',
        description:
          'Accès utilisateur standard, peut rejoindre et jouer aux parties.',
        permissions: ['game.play', 'game.history', 'chat.read'],
      },
      {
        name: 'ROLE_MODERATOR',
        description:
          'Peut gérer les utilisateurs (ban/unban) et surveiller les parties.',
        permissions: ['game.play', 'game.history', 'chat.read', 'admin.users'],
      },
      {
        name: 'ROLE_ADMIN',
        description:
          "Accès complet à l'administration, aux jeux et aux configurations.",
        permissions: ['admin.*', 'game.*', 'log.read'],
      },
    ];
  }

  private async ensureSeeded(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) {
      return;
    }

    const definitions = this.getDefaultDefinitions();
    await this.repo.save(
      definitions
        .filter((definition) => definition?.name && definition?.description)
        .map((definition) => ({
          name: definition.name,
          description: definition.description,
          permissions: Array.isArray(definition.permissions)
            ? definition.permissions
            : [],
        })),
    );
    this.cache = null;
  }
}
