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
exports.AdminUsersWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const admin_users_service_1 = require("../services/admin-users.service");
const admin_catalog_invalidation_service_1 = require("../services/admin-catalog-invalidation.service");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminUsersWsHandler = class AdminUsersWsHandler {
    validator;
    users;
    catalogInvalidation;
    constructor(validator, users, catalogInvalidation) {
        this.validator = validator;
        this.users = users;
        this.catalogInvalidation = catalogInvalidation;
    }
    async usersList(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminListUsersWsDto, payload);
        const query = {
            search: dto.search,
            role: dto.role,
            status: dto.status ?? 'all',
            createdAfter: dto.createdAfter,
            createdBefore: dto.createdBefore,
            page: dto.page ?? 1,
            limit: dto.limit ?? 20,
        };
        const result = await this.users.list(query);
        return { type: 'admin.users.list', payload: result };
    }
    async usersGet(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminUserIdWsDto, payload);
        const user = await this.users.get(dto.id);
        return { type: 'admin.users.get', payload: { user } };
    }
    async usersBan(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminBanUserWsDto, payload);
        const res = await this.users.ban(dto.id, dto.reason, dto.durationDays, dto.bannedUntil ?? null);
        return { type: 'admin.users.ban', payload: res };
    }
    async usersUnban(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminUserIdWsDto, payload);
        const res = await this.users.unban(dto.id);
        return { type: 'admin.users.unban', payload: res };
    }
    async usersDelete(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminUserIdWsDto, payload);
        const res = await this.users.delete(dto.id);
        return { type: 'admin.users.delete', payload: res };
    }
    async usersUpdateRoles(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminUserRolesWsDto, payload);
        const user = await this.users.update(dto.id, { roles: dto.roles });
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return { type: 'admin.users.rolesUpdated', payload: { user } };
    }
};
exports.AdminUsersWsHandler = AdminUsersWsHandler;
exports.AdminUsersWsHandler = AdminUsersWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        admin_users_service_1.AdminUsersService,
        admin_catalog_invalidation_service_1.AdminCatalogInvalidationService])
], AdminUsersWsHandler);
//# sourceMappingURL=admin-users-ws.handler.js.map