import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RoleDefinitionRepository } from '../../../../application/ports/role-definition.repository';
import type { RoleDefinition } from '../../../../domain/models/role-definition.model';
import { RoleDefinitionEntity } from '../entities/role-definition.entity';

@Injectable()
export class RoleDefinitionTypeormRepository
  implements RoleDefinitionRepository
{
  constructor(
    @InjectRepository(RoleDefinitionEntity)
    private readonly repo: Repository<RoleDefinitionEntity>,
  ) {}

  async findAll(): Promise<RoleDefinition[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toModel(row));
  }

  async findByName(name: string): Promise<RoleDefinition | null> {
    const row = await this.repo.findOne({ where: { name } });
    return row ? this.toModel(row) : null;
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  async insert(definition: RoleDefinition): Promise<void> {
    await this.repo.insert(this.toEntity(definition));
  }

  async saveMany(definitions: RoleDefinition[]): Promise<void> {
    await this.repo.save(definitions.map((definition) => this.toEntity(definition)));
  }

  async update(
    name: string,
    update: Partial<RoleDefinition> & { name?: string },
  ): Promise<void> {
    const current = await this.repo.findOne({ where: { name } });
    if (!current) {
      return;
    }

    const nextName = update.name ?? current.name;
    await this.repo.manager.transaction(async (manager) => {
      if (nextName !== name) {
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
  }

  async delete(name: string): Promise<boolean> {
    const result = await this.repo.delete({ name });
    return Boolean(result.affected);
  }

  private toModel(row: RoleDefinitionEntity): RoleDefinition {
    return {
      name: row.name,
      description: row.description,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    };
  }

  private toEntity(definition: RoleDefinition): RoleDefinitionEntity {
    return {
      name: definition.name,
      description: definition.description,
      permissions: Array.isArray(definition.permissions)
        ? definition.permissions
        : [],
    };
  }
}
