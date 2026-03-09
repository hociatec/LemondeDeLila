"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminUsersWsHandler", {
    enumerable: true,
    get: function() {
        return AdminUsersWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _adminusersservice = require("../services/admin-users.service");
const _admincataloginvalidationservice = require("../services/admin-catalog-invalidation.service");
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
let AdminUsersWsHandler = class AdminUsersWsHandler {
    async usersList(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminListUsersWsDto, payload);
        const query = {
            search: dto.search,
            role: dto.role,
            status: dto.status ?? 'all',
            createdAfter: dto.createdAfter,
            createdBefore: dto.createdBefore,
            page: dto.page ?? 1,
            limit: dto.limit ?? 20
        };
        const result = await this.users.list(query);
        return {
            type: 'admin.users.list',
            payload: result
        };
    }
    async usersGet(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminUserIdWsDto, payload);
        const user = await this.users.get(dto.id);
        return {
            type: 'admin.users.get',
            payload: {
                user
            }
        };
    }
    async usersBan(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminBanUserWsDto, payload);
        const res = await this.users.ban(dto.id, dto.reason, dto.durationDays, dto.bannedUntil ?? null);
        return {
            type: 'admin.users.ban',
            payload: res
        };
    }
    async usersUnban(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminUserIdWsDto, payload);
        const res = await this.users.unban(dto.id);
        return {
            type: 'admin.users.unban',
            payload: res
        };
    }
    async usersDelete(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminUserIdWsDto, payload);
        const res = await this.users.delete(dto.id);
        return {
            type: 'admin.users.delete',
            payload: res
        };
    }
    async usersUpdateRoles(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminUserRolesWsDto, payload);
        const user = await this.users.update(dto.id, {
            roles: dto.roles
        });
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return {
            type: 'admin.users.rolesUpdated',
            payload: {
                user
            }
        };
    }
    constructor(validator, users, catalogInvalidation){
        this.validator = validator;
        this.users = users;
        this.catalogInvalidation = catalogInvalidation;
    }
};
AdminUsersWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _adminusersservice.AdminUsersService === "undefined" ? Object : _adminusersservice.AdminUsersService,
        typeof _admincataloginvalidationservice.AdminCatalogInvalidationService === "undefined" ? Object : _admincataloginvalidationservice.AdminCatalogInvalidationService
    ])
], AdminUsersWsHandler);
