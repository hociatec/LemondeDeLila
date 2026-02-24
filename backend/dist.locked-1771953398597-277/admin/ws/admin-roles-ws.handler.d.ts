import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
import { RoleDefinitionsService } from '../services/role-definitions.service';
export declare class AdminRolesWsHandler {
    private readonly validator;
    private readonly roleDefinitions;
    private readonly catalogInvalidation;
    constructor(validator: PayloadValidationService, roleDefinitions: RoleDefinitionsService, catalogInvalidation: AdminCatalogInvalidationService);
    rolesList(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roles: string[];
            definitions: import("../services/role-definitions.service").RoleDefinition[];
        };
    }>;
    rolesDefinitionsList(session: WsSession): Promise<{
        type: string;
        payload: {
            definitions: import("../services/role-definitions.service").RoleDefinition[];
        };
    }>;
    roleDefinitionCreate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            definitions: import("../services/role-definitions.service").RoleDefinition[];
        };
    }>;
    roleDefinitionUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            definitions: import("../services/role-definitions.service").RoleDefinition[];
        };
    }>;
    roleDefinitionDelete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            definitions: import("../services/role-definitions.service").RoleDefinition[];
        };
    }>;
}
