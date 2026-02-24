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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUsersController = void 0;
const common_1 = require("@nestjs/common");
const admin_users_service_1 = require("../services/admin-users.service");
const admin_create_user_dto_1 = require("../dto/admin-create-user.dto");
const admin_update_user_dto_1 = require("../dto/admin-update-user.dto");
const admin_list_users_dto_1 = require("../dto/admin-list-users.dto");
const admin_ban_user_dto_1 = require("../dto/admin-ban-user.dto");
const http_jwt_guard_1 = require("../../common/guards/http-jwt.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminUsersController = class AdminUsersController {
    adminUsers;
    constructor(adminUsers) {
        this.adminUsers = adminUsers;
    }
    async list(query) {
        return this.adminUsers.list(query);
    }
    async get(id) {
        return this.adminUsers.get(id);
    }
    async create(body) {
        return this.adminUsers.create(body);
    }
    async update(id, body) {
        return this.adminUsers.update(id, body);
    }
    async resetPassword(id) {
        return this.adminUsers.resetPassword(id);
    }
    async delete(id) {
        return this.adminUsers.delete(id);
    }
    async ban(id, body) {
        return this.adminUsers.ban(id, body.reason, body.durationDays, body.bannedUntil);
    }
    async unban(id) {
        return this.adminUsers.unban(id);
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_users_dto_1.AdminListUsersDto]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_create_user_dto_1.AdminCreateUserDto]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, admin_update_user_dto_1.AdminUpdateUserDto]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/reset-password'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/ban'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, admin_ban_user_dto_1.AdminBanUserDto]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "ban", null);
__decorate([
    (0, common_1.Post)(':id/unban'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "unban", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, common_1.Controller)('api/admin/users'),
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [admin_users_service_1.AdminUsersService])
], AdminUsersController);
//# sourceMappingURL=admin-users.controller.js.map