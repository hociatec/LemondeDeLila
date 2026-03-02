"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminUsersController", {
    enumerable: true,
    get: function() {
        return AdminUsersController;
    }
});
const _common = require("@nestjs/common");
const _adminusersservice = require("../services/admin-users.service");
const _admincreateuserdto = require("../dto/admin-create-user.dto");
const _adminupdateuserdto = require("../dto/admin-update-user.dto");
const _adminlistusersdto = require("../dto/admin-list-users.dto");
const _adminbanuserdto = require("../dto/admin-ban-user.dto");
const _httpjwtguard = require("../../common/guards/http-jwt.guard");
const _adminroleguard = require("../../common/guards/admin-role.guard");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let AdminUsersController = class AdminUsersController {
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
    constructor(adminUsers){
        this.adminUsers = adminUsers;
    }
};
_ts_decorate([
    (0, _common.Get)(),
    _ts_param(0, (0, _common.Query)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _adminlistusersdto.AdminListUsersDto === "undefined" ? Object : _adminlistusersdto.AdminListUsersDto
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "list", null);
_ts_decorate([
    (0, _common.Get)(':id'),
    _ts_param(0, (0, _common.Param)('id', _common.ParseIntPipe)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Number
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "get", null);
_ts_decorate([
    (0, _common.Post)(),
    _ts_param(0, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _admincreateuserdto.AdminCreateUserDto === "undefined" ? Object : _admincreateuserdto.AdminCreateUserDto
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "create", null);
_ts_decorate([
    (0, _common.Patch)(':id'),
    _ts_param(0, (0, _common.Param)('id', _common.ParseIntPipe)),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Number,
        typeof _adminupdateuserdto.AdminUpdateUserDto === "undefined" ? Object : _adminupdateuserdto.AdminUpdateUserDto
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "update", null);
_ts_decorate([
    (0, _common.Post)(':id/reset-password'),
    _ts_param(0, (0, _common.Param)('id', _common.ParseIntPipe)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Number
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "resetPassword", null);
_ts_decorate([
    (0, _common.Delete)(':id'),
    _ts_param(0, (0, _common.Param)('id', _common.ParseIntPipe)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Number
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "delete", null);
_ts_decorate([
    (0, _common.Post)(':id/ban'),
    _ts_param(0, (0, _common.Param)('id', _common.ParseIntPipe)),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Number,
        typeof _adminbanuserdto.AdminBanUserDto === "undefined" ? Object : _adminbanuserdto.AdminBanUserDto
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "ban", null);
_ts_decorate([
    (0, _common.Post)(':id/unban'),
    _ts_param(0, (0, _common.Param)('id', _common.ParseIntPipe)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Number
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminUsersController.prototype, "unban", null);
AdminUsersController = _ts_decorate([
    (0, _common.Controller)('api/admin/users'),
    (0, _common.UseGuards)(_httpjwtguard.HttpJwtGuard, _adminroleguard.AdminRoleGuard),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _adminusersservice.AdminUsersService === "undefined" ? Object : _adminusersservice.AdminUsersService
    ])
], AdminUsersController);
