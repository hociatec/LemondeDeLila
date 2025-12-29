import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { RoleDefinitionEntity } from '../entities/role-definition.entity';

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

@Injectable()
export class RoleDefinitionsService implements OnModuleInit {
  private readonly logger = new Logger(RoleDefinitionsService.name);
  private cache: RoleDefinition[] | null = null;
  private _filePath: string | null = null;

  constructor(
    @InjectRepository(RoleDefinitionEntity)
    private readonly repo: Repository<RoleDefinitionEntity>,
  ) {}

  private get filePath(): string {
    if (!this._filePath) {
      this._filePath = path.resolve(process.cwd(), 'data', 'role-definitions.json');
    }
    return this._filePath;
  }

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
    if (current.some((d) => d.name === definition.name)) {
      throw new Error(`Le rôle '${definition.name}' existe déjà.`);
    }
    await this.repo.insert({
      name: definition.name,
      description: definition.description,
      permissions: definition.permissions ?? [],
    });
    this.cache = null;
  }

  async update(name: string, update: Partial<RoleDefinition> & { name?: string }): Promise<void> {
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
    const res = await this.repo.delete({ name });
    if (!res.affected) {
      throw new Error(`Rôle '${name}' introuvable.`);
    }
    this.cache = null;
  }

  private getDefaultDefinitions(): RoleDefinition[] {
    return [
      {
        name: 'ROLE_USER',
        description: "Accès utilisateur standard, peut rejoindre et jouer aux parties.",
        permissions: ['game.play', 'game.history', 'chat.read'],
      },
      {
        name: 'ROLE_MODERATOR',
        description: 'Peut gérer les utilisateurs (ban/unban) et surveiller les parties.',
        permissions: ['game.play', 'game.history', 'chat.read', 'admin.users'],
      },
      {
        name: 'ROLE_ADMIN',
        description: 'Accès complet à l’administration, aux jeux et aux configurations.',
        permissions: ['admin.*', 'game.*', 'log.read'],
      },
    ];
  }

  private tryLoadFromJson(): RoleDefinition[] | null {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as RoleDefinition[];
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      this.logger.warn(
        `Impossible de charger role-definitions depuis JSON (${this.filePath}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async ensureSeeded(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;

    const fromFile = this.tryLoadFromJson();
    const definitions =
      fromFile && fromFile.length > 0 ? fromFile : this.getDefaultDefinitions();

    await this.repo.save(
      definitions
        .filter((d) => d?.name && d?.description)
        .map((d) => ({
          name: d.name,
          description: d.description,
          permissions: Array.isArray(d.permissions) ? d.permissions : [],
        })),
    );
    this.cache = null;
  }
}
