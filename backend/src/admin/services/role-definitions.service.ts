import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

@Injectable()
export class RoleDefinitionsService {
  private cache: RoleDefinition[] | null = null;
  private _filePath: string | null = null;

  private get filePath(): string {
    if (!this._filePath) {
      this._filePath = path.resolve(process.cwd(), 'data', 'role-definitions.json');
    }
    return this._filePath;
  }

  async list(): Promise<RoleDefinition[]> {
    if (this.cache) {
      return this.cache;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    let content: string;
    try {
      content = await fs.readFile(this.filePath, 'utf-8');
    } catch {
      const defaults = this.getDefaultDefinitions();
      await this.saveDefinitions(defaults);
      this.cache = defaults;
      return defaults;
    }

    try {
      const parsed = JSON.parse(content) as RoleDefinition[];
      this.cache = parsed;
      return parsed;
    } catch {
      const defaults = this.getDefaultDefinitions();
      await this.saveDefinitions(defaults);
      this.cache = defaults;
      return defaults;
    }
  }

  async create(definition: RoleDefinition): Promise<void> {
    const current = await this.list();
    if (current.some((d) => d.name === definition.name)) {
      throw new Error(`Le rôle '${definition.name}' existe déjà.`);
    }
    const next = [...current, definition];
    await this.saveDefinitions(next);
    this.cache = next;
  }

  async update(name: string, update: Partial<RoleDefinition> & { name?: string }): Promise<void> {
    const current = await this.list();
    const idx = current.findIndex((d) => d.name === name);
    if (idx < 0) {
      throw new Error(`Rôle '${name}' introuvable.`);
    }
    const updatedName = update.name ?? current[idx].name;
    if (updatedName !== name && current.some((d) => d.name === updatedName)) {
      throw new Error(`Le rôle '${updatedName}' existe déjà.`);
    }
    const updated: RoleDefinition = {
      ...current[idx],
      ...update,
      name: updatedName,
      description: update.description ?? current[idx].description,
      permissions: update.permissions ?? current[idx].permissions,
    };
    const next = [...current];
    next[idx] = updated;
    await this.saveDefinitions(next);
    this.cache = next;
  }

  async delete(name: string): Promise<void> {
    const current = await this.list();
    const next = current.filter((d) => d.name !== name);
    if (next.length === current.length) {
      throw new Error(`Rôle '${name}' introuvable.`);
    }
    await this.saveDefinitions(next);
    this.cache = next;
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

  private async saveDefinitions(definitions: RoleDefinition[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(definitions, null, 2), 'utf-8');
  }
}
