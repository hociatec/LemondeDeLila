"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRolesWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const admin_catalog_invalidation_service_1 = require("../services/admin-catalog-invalidation.service");
const role_definitions_service_1 = require("../services/role-definitions.service");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminRolesWsHandler = class AdminRolesWsHandler {
    validator;
    roleDefinitions;
    catalogInvalidation;
    constructor(validator, roleDefinitions, catalogInvalidation) {
        this.validator = validator;
        this.roleDefinitions = roleDefinitions;
        this.catalogInvalidation = catalogInvalidation;
    }
    async rolesList(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_ws_dto_1.AdminRolesListWsDto, payload ?? {});
        const definitions = await this.roleDefinitions.list();
        return {
            type: 'admin.roles.list',
            payload: {
                roles: definitions.map((d) => d.name),
                definitions,
            },
        };
    }
    async rolesDefinitionsList(session) {
        (0, ws_auth_1.requireAdmin)(session);
        const definitions = await this.roleDefinitions.list();
        return {
            type: 'admin.roles.definitions',
            payload: { definitions },
        };
    }
    async roleDefinitionCreate(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminRoleDefinitionCreateWsDto, payload);
        await this.roleDefinitions.create({
            name: dto.name,
            description: dto.description,
            permissions: dto.permissions,
        });
        await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
        return this.rolesDefinitionsList(session);
    }
    async roleDefinitionUpdate(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminRoleDefinitionUpdateWsDto, payload);
        await this.roleDefinitions.update(dto.name, {
            name: dto.newName,
            description: dto.description,
            permissions: dto.permissions,
        });
        await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
        return this.rolesDefinitionsList(session);
    }
    async roleDefinitionDelete(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminRoleDefinitionDeleteWsDto, payload);
        await this.roleDefinitions.delete(dto.name);
        await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
        return this.rolesDefinitionsList(session);
    }
};
exports.AdminRolesWsHandler = AdminRolesWsHandler;
exports.AdminRolesWsHandler = AdminRolesWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        role_definitions_service_1.RoleDefinitionsService,
        admin_catalog_invalidation_service_1.AdminCatalogInvalidationService])
], AdminRolesWsHandler);
//# sourceMappingURL=admin-roles-ws.handler.js.map