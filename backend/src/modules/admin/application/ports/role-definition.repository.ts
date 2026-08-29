import type { RoleDefinition } from '../../domain/models/role-definition.model';

export const ROLE_DEFINITION_REPOSITORY = Symbol('ROLE_DEFINITION_REPOSITORY');

export interface RoleDefinitionRepository {
  findAll(): Promise<RoleDefinition[]>;
  findByName(name: string): Promise<RoleDefinition | null>;
  count(): Promise<number>;
  insert(definition: RoleDefinition): Promise<void>;
  saveMany(definitions: RoleDefinition[]): Promise<void>;
  update(
    name: string,
    update: Partial<RoleDefinition> & { name?: string },
  ): Promise<void>;
  delete(name: string): Promise<boolean>;
}
