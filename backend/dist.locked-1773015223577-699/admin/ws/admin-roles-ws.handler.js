"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminRolesWsHandler", {
    enumerable: true,
    get: function() {
        return AdminRolesWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _admincataloginvalidationservice = require("../services/admin-catalog-invalidation.service");
const _roledefinitionsservice = require("../services/role-definitions.service");
const _adminwsdto = require("./admin-ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminRolesWsHandler = class AdminRolesWsHandler {
    async rolesList(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminwsdto.AdminRolesListWsDto, payload ?? {});
        const definitions = await this.roleDefinitions.list();
        return {
            type: 'admin.roles.list',
            payload: {
                roles: definitions.map((d)=>d.name),
                definitions
            }
        };
    }
    async rolesDefinitionsList(session) {
        (0, _wsauth.requireAdmin)(session);
        const definitions = await this.roleDefinitions.list();
        return {
            type: 'admin.roles.definitions',
            payload: {
                definitions
            }
        };
    }
    async roleDefinitionCreate(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminRoleDefinitionCreateWsDto, payload);
        await this.roleDefinitions.create({
            name: dto.name,
            description: dto.description,
            permissions: dto.permissions
        });
        await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
        return this.rolesDefinitionsList(session);
    }
    async roleDefinitionUpdate(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminRoleDefinitionUpdateWsDto, payload);
        await this.roleDefinitions.update(dto.name, {
            name: dto.newName,
            description: dto.description,
            permissions: dto.permissions
        });
        await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
        return this.rolesDefinitionsList(session);
    }
    async roleDefinitionDelete(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminRoleDefinitionDeleteWsDto, payload);
        await this.roleDefinitions.delete(dto.name);
        await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
        return this.rolesDefinitionsList(session);
    }
    constructor(validator, roleDefinitions, catalogInvalidation){
        this.validator = validator;
        this.roleDefinitions = roleDefinitions;
        this.catalogInvalidation = catalogInvalidation;
    }
};
AdminRolesWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _roledefinitionsservice.RoleDefinitionsService === "undefined" ? Object : _roledefinitionsservice.RoleDefinitionsService,
        typeof _admincataloginvalidationservice.AdminCatalogInvalidationService === "undefined" ? Object : _admincataloginvalidationservice.AdminCatalogInvalidationService
    ])
], AdminRolesWsHandler);
