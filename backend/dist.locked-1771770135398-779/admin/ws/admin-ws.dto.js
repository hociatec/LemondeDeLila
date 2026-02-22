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
exports.AdminBotSettingsUpdateWsDto = exports.AdminBotSettingsGetWsDto = exports.AdminBotNameDeleteWsDto = exports.AdminBotNameUpdateWsDto = exports.AdminBotNameCreateWsDto = exports.AdminBotNamesListWsDto = exports.AdminRoleDefinitionDeleteWsDto = exports.AdminRoleDefinitionUpdateWsDto = exports.AdminRoleDefinitionCreateWsDto = exports.AdminRoleDefinitionDto = exports.AdminLogsDownloadWsDto = exports.AdminUserRolesWsDto = exports.AdminGameCategoryDeleteWsDto = exports.AdminGameCategoryAssignWsDto = exports.AdminGameCategoryUpdateWsDto = exports.AdminGameCategoryCreateWsDto = exports.AdminGameCategoriesListWsDto = exports.AdminGameResetWsDto = exports.AdminGameUpdateWsDto = exports.AdminGameSetEnabledWsDto = exports.AdminChatUnbanWsDto = exports.AdminChatBanWsDto = exports.AdminPerfSnapshotWsDto = exports.AdminChatClearWsDto = exports.AdminChatDeleteWsDto = exports.AdminChatSettingsUpdateWsDto = exports.AdminChatSettingsGetWsDto = exports.AdminChatMessagesWsDto = exports.AdminClientUpdateScheduleWsDto = exports.AdminClientUpdateForceLatestWsDto = exports.AdminClientUpdateAnnounceWsDto = exports.AdminBroadcastWsDto = exports.AdminBanUserWsDto = exports.AdminUserIdWsDto = exports.AdminRolesListWsDto = exports.AdminListUsersWsDto = void 0;
const class_validator_1 = require("class-validator");
class AdminListUsersWsDto {
    search;
    role;
    status;
    createdAfter;
    createdBefore;
    page;
    limit;
}
exports.AdminListUsersWsDto = AdminListUsersWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminListUsersWsDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], AdminListUsersWsDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['all', 'active', 'banned']),
    __metadata("design:type", String)
], AdminListUsersWsDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdminListUsersWsDto.prototype, "createdAfter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdminListUsersWsDto.prototype, "createdBefore", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminListUsersWsDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminListUsersWsDto.prototype, "limit", void 0);
class AdminRolesListWsDto {
    _noop;
}
exports.AdminRolesListWsDto = AdminRolesListWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminRolesListWsDto.prototype, "_noop", void 0);
class AdminUserIdWsDto {
    id;
}
exports.AdminUserIdWsDto = AdminUserIdWsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AdminUserIdWsDto.prototype, "id", void 0);
class AdminBanUserWsDto extends AdminUserIdWsDto {
    reason;
    durationDays;
    bannedUntil;
}
exports.AdminBanUserWsDto = AdminBanUserWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminBanUserWsDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminBanUserWsDto.prototype, "durationDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AdminBanUserWsDto.prototype, "bannedUntil", void 0);
class AdminBroadcastWsDto {
    message;
}
exports.AdminBroadcastWsDto = AdminBroadcastWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdminBroadcastWsDto.prototype, "message", void 0);
class AdminClientUpdateAnnounceWsDto {
    message;
    version;
}
exports.AdminClientUpdateAnnounceWsDto = AdminClientUpdateAnnounceWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdminClientUpdateAnnounceWsDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminClientUpdateAnnounceWsDto.prototype, "version", void 0);
class AdminClientUpdateForceLatestWsDto {
    message;
}
exports.AdminClientUpdateForceLatestWsDto = AdminClientUpdateForceLatestWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdminClientUpdateForceLatestWsDto.prototype, "message", void 0);
class AdminClientUpdateScheduleWsDto {
    message;
    delayMinutes;
    delaySeconds;
}
exports.AdminClientUpdateScheduleWsDto = AdminClientUpdateScheduleWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdminClientUpdateScheduleWsDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1440),
    __metadata("design:type", Number)
], AdminClientUpdateScheduleWsDto.prototype, "delayMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(60),
    (0, class_validator_1.Max)(86400),
    __metadata("design:type", Number)
], AdminClientUpdateScheduleWsDto.prototype, "delaySeconds", void 0);
class AdminChatMessagesWsDto {
    limit;
    includeDeleted;
}
exports.AdminChatMessagesWsDto = AdminChatMessagesWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminChatMessagesWsDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminChatMessagesWsDto.prototype, "includeDeleted", void 0);
class AdminChatSettingsGetWsDto {
    _noop;
}
exports.AdminChatSettingsGetWsDto = AdminChatSettingsGetWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminChatSettingsGetWsDto.prototype, "_noop", void 0);
class AdminChatSettingsUpdateWsDto {
    chatHistoryLimit;
    editWindowSeconds;
}
exports.AdminChatSettingsUpdateWsDto = AdminChatSettingsUpdateWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], AdminChatSettingsUpdateWsDto.prototype, "chatHistoryLimit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(86400),
    __metadata("design:type", Number)
], AdminChatSettingsUpdateWsDto.prototype, "editWindowSeconds", void 0);
class AdminChatDeleteWsDto {
    messageId;
}
exports.AdminChatDeleteWsDto = AdminChatDeleteWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminChatDeleteWsDto.prototype, "messageId", void 0);
class AdminChatClearWsDto {
    _noop;
}
exports.AdminChatClearWsDto = AdminChatClearWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminChatClearWsDto.prototype, "_noop", void 0);
class AdminPerfSnapshotWsDto {
    windowSeconds;
}
exports.AdminPerfSnapshotWsDto = AdminPerfSnapshotWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminPerfSnapshotWsDto.prototype, "windowSeconds", void 0);
class AdminChatBanWsDto extends AdminUserIdWsDto {
    reason;
    durationDays;
}
exports.AdminChatBanWsDto = AdminChatBanWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], AdminChatBanWsDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminChatBanWsDto.prototype, "durationDays", void 0);
class AdminChatUnbanWsDto extends AdminUserIdWsDto {
    _noop;
}
exports.AdminChatUnbanWsDto = AdminChatUnbanWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminChatUnbanWsDto.prototype, "_noop", void 0);
class AdminGameSetEnabledWsDto {
    gameType;
    enabled;
}
exports.AdminGameSetEnabledWsDto = AdminGameSetEnabledWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminGameSetEnabledWsDto.prototype, "gameType", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminGameSetEnabledWsDto.prototype, "enabled", void 0);
class AdminGameUpdateWsDto {
    gameType;
    enabled;
    minPlayers;
    maxPlayers;
    name;
    description;
    rules;
    status;
    chatEnabled;
    chatSoundsEnabled;
}
exports.AdminGameUpdateWsDto = AdminGameUpdateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "gameType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminGameUpdateWsDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminGameUpdateWsDto.prototype, "minPlayers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminGameUpdateWsDto.prototype, "maxPlayers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "rules", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['construction', 'beta', 'finished']),
    __metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminGameUpdateWsDto.prototype, "chatEnabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminGameUpdateWsDto.prototype, "chatSoundsEnabled", void 0);
class AdminGameResetWsDto {
    gameType;
}
exports.AdminGameResetWsDto = AdminGameResetWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminGameResetWsDto.prototype, "gameType", void 0);
class AdminGameCategoriesListWsDto {
    _noop;
}
exports.AdminGameCategoriesListWsDto = AdminGameCategoriesListWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminGameCategoriesListWsDto.prototype, "_noop", void 0);
class AdminGameCategoryCreateWsDto {
    name;
    parentId;
}
exports.AdminGameCategoryCreateWsDto = AdminGameCategoryCreateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminGameCategoryCreateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], AdminGameCategoryCreateWsDto.prototype, "parentId", void 0);
class AdminGameCategoryUpdateWsDto {
    id;
    name;
    parentId;
}
exports.AdminGameCategoryUpdateWsDto = AdminGameCategoryUpdateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminGameCategoryUpdateWsDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminGameCategoryUpdateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], AdminGameCategoryUpdateWsDto.prototype, "parentId", void 0);
class AdminGameCategoryAssignWsDto {
    gameType;
    categoryId;
}
exports.AdminGameCategoryAssignWsDto = AdminGameCategoryAssignWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminGameCategoryAssignWsDto.prototype, "gameType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], AdminGameCategoryAssignWsDto.prototype, "categoryId", void 0);
class AdminGameCategoryDeleteWsDto {
    id;
}
exports.AdminGameCategoryDeleteWsDto = AdminGameCategoryDeleteWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminGameCategoryDeleteWsDto.prototype, "id", void 0);
class AdminUserRolesWsDto {
    id;
    roles;
}
exports.AdminUserRolesWsDto = AdminUserRolesWsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AdminUserRolesWsDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AdminUserRolesWsDto.prototype, "roles", void 0);
class AdminLogsDownloadWsDto {
    lines;
    filter;
}
exports.AdminLogsDownloadWsDto = AdminLogsDownloadWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminLogsDownloadWsDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminLogsDownloadWsDto.prototype, "filter", void 0);
class AdminRoleDefinitionDto {
    name;
    description;
    permissions;
}
exports.AdminRoleDefinitionDto = AdminRoleDefinitionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], AdminRoleDefinitionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], AdminRoleDefinitionDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AdminRoleDefinitionDto.prototype, "permissions", void 0);
class AdminRoleDefinitionCreateWsDto {
    name;
    description;
    permissions;
}
exports.AdminRoleDefinitionCreateWsDto = AdminRoleDefinitionCreateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], AdminRoleDefinitionCreateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], AdminRoleDefinitionCreateWsDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AdminRoleDefinitionCreateWsDto.prototype, "permissions", void 0);
class AdminRoleDefinitionUpdateWsDto {
    name;
    description;
    permissions;
    newName;
}
exports.AdminRoleDefinitionUpdateWsDto = AdminRoleDefinitionUpdateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], AdminRoleDefinitionUpdateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], AdminRoleDefinitionUpdateWsDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AdminRoleDefinitionUpdateWsDto.prototype, "permissions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], AdminRoleDefinitionUpdateWsDto.prototype, "newName", void 0);
class AdminRoleDefinitionDeleteWsDto {
    name;
}
exports.AdminRoleDefinitionDeleteWsDto = AdminRoleDefinitionDeleteWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], AdminRoleDefinitionDeleteWsDto.prototype, "name", void 0);
class AdminBotNamesListWsDto {
    _noop;
}
exports.AdminBotNamesListWsDto = AdminBotNamesListWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminBotNamesListWsDto.prototype, "_noop", void 0);
class AdminBotNameCreateWsDto {
    name;
    enabled;
}
exports.AdminBotNameCreateWsDto = AdminBotNameCreateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], AdminBotNameCreateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminBotNameCreateWsDto.prototype, "enabled", void 0);
class AdminBotNameUpdateWsDto {
    id;
    name;
    enabled;
}
exports.AdminBotNameUpdateWsDto = AdminBotNameUpdateWsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AdminBotNameUpdateWsDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], AdminBotNameUpdateWsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminBotNameUpdateWsDto.prototype, "enabled", void 0);
class AdminBotNameDeleteWsDto {
    id;
}
exports.AdminBotNameDeleteWsDto = AdminBotNameDeleteWsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AdminBotNameDeleteWsDto.prototype, "id", void 0);
class AdminBotSettingsGetWsDto {
    _noop;
}
exports.AdminBotSettingsGetWsDto = AdminBotSettingsGetWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminBotSettingsGetWsDto.prototype, "_noop", void 0);
class AdminBotSettingsUpdateWsDto {
    botTurnDelayMs;
    botStartDelayMs;
    botDrawDelayMs;
}
exports.AdminBotSettingsUpdateWsDto = AdminBotSettingsUpdateWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminBotSettingsUpdateWsDto.prototype, "botTurnDelayMs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminBotSettingsUpdateWsDto.prototype, "botStartDelayMs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminBotSettingsUpdateWsDto.prototype, "botDrawDelayMs", void 0);
//# sourceMappingURL=admin-ws.dto.js.map