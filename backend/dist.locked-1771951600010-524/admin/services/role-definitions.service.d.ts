import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RoleDefinitionEntity } from '../entities/role-definition.entity';
export interface RoleDefinition {
    name: string;
    description: string;
    permissions: string[];
}
export declare class RoleDefinitionsService implements OnModuleInit {
    private readonly repo;
    private cache;
    constructor(repo: Repository<RoleDefinitionEntity>);
    onModuleInit(): Promise<void>;
    list(): Promise<RoleDefinition[]>;
    create(definition: RoleDefinition): Promise<void>;
    update(name: string, update: Partial<RoleDefinition> & {
        name?: string;
    }): Promise<void>;
    delete(name: string): Promise<void>;
    private getDefaultDefinitions;
    private ensureSeeded;
}
