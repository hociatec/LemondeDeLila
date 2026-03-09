"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get AdminBanUserWsDto () {
        return AdminBanUserWsDto;
    },
    get AdminBotNameCreateWsDto () {
        return AdminBotNameCreateWsDto;
    },
    get AdminBotNameDeleteWsDto () {
        return AdminBotNameDeleteWsDto;
    },
    get AdminBotNameUpdateWsDto () {
        return AdminBotNameUpdateWsDto;
    },
    get AdminBotNamesListWsDto () {
        return AdminBotNamesListWsDto;
    },
    get AdminBotSettingsGetWsDto () {
        return AdminBotSettingsGetWsDto;
    },
    get AdminBotSettingsUpdateWsDto () {
        return AdminBotSettingsUpdateWsDto;
    },
    get AdminBroadcastWsDto () {
        return AdminBroadcastWsDto;
    },
    get AdminChatBanWsDto () {
        return AdminChatBanWsDto;
    },
    get AdminChatClearWsDto () {
        return AdminChatClearWsDto;
    },
    get AdminChatDeleteWsDto () {
        return AdminChatDeleteWsDto;
    },
    get AdminChatMessagesWsDto () {
        return AdminChatMessagesWsDto;
    },
    get AdminChatSettingsGetWsDto () {
        return AdminChatSettingsGetWsDto;
    },
    get AdminChatSettingsUpdateWsDto () {
        return AdminChatSettingsUpdateWsDto;
    },
    get AdminChatUnbanWsDto () {
        return AdminChatUnbanWsDto;
    },
    get AdminClientUpdateAnnounceWsDto () {
        return AdminClientUpdateAnnounceWsDto;
    },
    get AdminClientUpdateForceLatestWsDto () {
        return AdminClientUpdateForceLatestWsDto;
    },
    get AdminClientUpdateScheduleWsDto () {
        return AdminClientUpdateScheduleWsDto;
    },
    get AdminGameCategoriesListWsDto () {
        return AdminGameCategoriesListWsDto;
    },
    get AdminGameCategoryAssignWsDto () {
        return AdminGameCategoryAssignWsDto;
    },
    get AdminGameCategoryCreateWsDto () {
        return AdminGameCategoryCreateWsDto;
    },
    get AdminGameCategoryDeleteWsDto () {
        return AdminGameCategoryDeleteWsDto;
    },
    get AdminGameCategoryUpdateWsDto () {
        return AdminGameCategoryUpdateWsDto;
    },
    get AdminGameResetWsDto () {
        return AdminGameResetWsDto;
    },
    get AdminGameSetEnabledWsDto () {
        return AdminGameSetEnabledWsDto;
    },
    get AdminGameUpdateWsDto () {
        return AdminGameUpdateWsDto;
    },
    get AdminListUsersWsDto () {
        return AdminListUsersWsDto;
    },
    get AdminLogsDownloadWsDto () {
        return AdminLogsDownloadWsDto;
    },
    get AdminPerfSnapshotWsDto () {
        return AdminPerfSnapshotWsDto;
    },
    get AdminRoleDefinitionCreateWsDto () {
        return AdminRoleDefinitionCreateWsDto;
    },
    get AdminRoleDefinitionDeleteWsDto () {
        return AdminRoleDefinitionDeleteWsDto;
    },
    get AdminRoleDefinitionDto () {
        return AdminRoleDefinitionDto;
    },
    get AdminRoleDefinitionUpdateWsDto () {
        return AdminRoleDefinitionUpdateWsDto;
    },
    get AdminRolesListWsDto () {
        return AdminRolesListWsDto;
    },
    get AdminUserIdWsDto () {
        return AdminUserIdWsDto;
    },
    get AdminUserRolesWsDto () {
        return AdminUserRolesWsDto;
    }
});
const _classvalidator = require("class-validator");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminListUsersWsDto = class AdminListUsersWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], AdminListUsersWsDto.prototype, "search", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(50),
    _ts_metadata("design:type", String)
], AdminListUsersWsDto.prototype, "role", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'all',
        'active',
        'banned'
    ]),
    _ts_metadata("design:type", String)
], AdminListUsersWsDto.prototype, "status", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsDateString)(),
    _ts_metadata("design:type", String)
], AdminListUsersWsDto.prototype, "createdAfter", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsDateString)(),
    _ts_metadata("design:type", String)
], AdminListUsersWsDto.prototype, "createdBefore", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminListUsersWsDto.prototype, "page", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminListUsersWsDto.prototype, "limit", void 0);
let AdminRolesListWsDto = class AdminRolesListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRolesListWsDto.prototype, "_noop", void 0);
let AdminUserIdWsDto = class AdminUserIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], AdminUserIdWsDto.prototype, "id", void 0);
let AdminBanUserWsDto = class AdminBanUserWsDto extends AdminUserIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminBanUserWsDto.prototype, "reason", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminBanUserWsDto.prototype, "durationDays", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    _ts_metadata("design:type", Object)
], AdminBanUserWsDto.prototype, "bannedUntil", void 0);
let AdminBroadcastWsDto = class AdminBroadcastWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(2000),
    _ts_metadata("design:type", String)
], AdminBroadcastWsDto.prototype, "message", void 0);
let AdminClientUpdateAnnounceWsDto = class AdminClientUpdateAnnounceWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(2000),
    _ts_metadata("design:type", String)
], AdminClientUpdateAnnounceWsDto.prototype, "message", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], AdminClientUpdateAnnounceWsDto.prototype, "version", void 0);
let AdminClientUpdateForceLatestWsDto = class AdminClientUpdateForceLatestWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(2000),
    _ts_metadata("design:type", String)
], AdminClientUpdateForceLatestWsDto.prototype, "message", void 0);
let AdminClientUpdateScheduleWsDto = class AdminClientUpdateScheduleWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(2000),
    _ts_metadata("design:type", String)
], AdminClientUpdateScheduleWsDto.prototype, "message", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.Max)(1440),
    _ts_metadata("design:type", Number)
], AdminClientUpdateScheduleWsDto.prototype, "delayMinutes", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(60),
    (0, _classvalidator.Max)(86400),
    _ts_metadata("design:type", Number)
], AdminClientUpdateScheduleWsDto.prototype, "delaySeconds", void 0);
let AdminChatMessagesWsDto = class AdminChatMessagesWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminChatMessagesWsDto.prototype, "limit", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminChatMessagesWsDto.prototype, "includeDeleted", void 0);
let AdminChatSettingsGetWsDto = class AdminChatSettingsGetWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminChatSettingsGetWsDto.prototype, "_noop", void 0);
let AdminChatSettingsUpdateWsDto = class AdminChatSettingsUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.Max)(2000),
    _ts_metadata("design:type", Number)
], AdminChatSettingsUpdateWsDto.prototype, "chatHistoryLimit", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    (0, _classvalidator.Max)(86400),
    _ts_metadata("design:type", Number)
], AdminChatSettingsUpdateWsDto.prototype, "editWindowSeconds", void 0);
let AdminChatDeleteWsDto = class AdminChatDeleteWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(64),
    _ts_metadata("design:type", String)
], AdminChatDeleteWsDto.prototype, "messageId", void 0);
let AdminChatClearWsDto = class AdminChatClearWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminChatClearWsDto.prototype, "_noop", void 0);
let AdminPerfSnapshotWsDto = class AdminPerfSnapshotWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminPerfSnapshotWsDto.prototype, "windowSeconds", void 0);
let AdminChatBanWsDto = class AdminChatBanWsDto extends AdminUserIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(255),
    _ts_metadata("design:type", String)
], AdminChatBanWsDto.prototype, "reason", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminChatBanWsDto.prototype, "durationDays", void 0);
let AdminChatUnbanWsDto = class AdminChatUnbanWsDto extends AdminUserIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminChatUnbanWsDto.prototype, "_noop", void 0);
let AdminGameSetEnabledWsDto = class AdminGameSetEnabledWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], AdminGameSetEnabledWsDto.prototype, "gameType", void 0);
_ts_decorate([
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminGameSetEnabledWsDto.prototype, "enabled", void 0);
let AdminGameUpdateWsDto = class AdminGameUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "gameType", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminGameUpdateWsDto.prototype, "enabled", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminGameUpdateWsDto.prototype, "minPlayers", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminGameUpdateWsDto.prototype, "maxPlayers", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(2000),
    _ts_metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "description", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(20000),
    _ts_metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "rules", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'construction',
        'beta',
        'finished'
    ]),
    _ts_metadata("design:type", String)
], AdminGameUpdateWsDto.prototype, "status", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminGameUpdateWsDto.prototype, "chatEnabled", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminGameUpdateWsDto.prototype, "chatSoundsEnabled", void 0);
let AdminGameResetWsDto = class AdminGameResetWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], AdminGameResetWsDto.prototype, "gameType", void 0);
let AdminGameCategoriesListWsDto = class AdminGameCategoriesListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminGameCategoriesListWsDto.prototype, "_noop", void 0);
let AdminGameCategoryCreateWsDto = class AdminGameCategoryCreateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminGameCategoryCreateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", Object)
], AdminGameCategoryCreateWsDto.prototype, "parentId", void 0);
let AdminGameCategoryUpdateWsDto = class AdminGameCategoryUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminGameCategoryUpdateWsDto.prototype, "id", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminGameCategoryUpdateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", Object)
], AdminGameCategoryUpdateWsDto.prototype, "parentId", void 0);
let AdminGameCategoryAssignWsDto = class AdminGameCategoryAssignWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], AdminGameCategoryAssignWsDto.prototype, "gameType", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", Object)
], AdminGameCategoryAssignWsDto.prototype, "categoryId", void 0);
let AdminGameCategoryDeleteWsDto = class AdminGameCategoryDeleteWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminGameCategoryDeleteWsDto.prototype, "id", void 0);
let AdminUserRolesWsDto = class AdminUserRolesWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], AdminUserRolesWsDto.prototype, "id", void 0);
_ts_decorate([
    (0, _classvalidator.IsArray)(),
    _ts_metadata("design:type", Array)
], AdminUserRolesWsDto.prototype, "roles", void 0);
let AdminLogsDownloadWsDto = class AdminLogsDownloadWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Number)
], AdminLogsDownloadWsDto.prototype, "lines", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminLogsDownloadWsDto.prototype, "filter", void 0);
let AdminRoleDefinitionDto = class AdminRoleDefinitionDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(400),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionDto.prototype, "description", void 0);
_ts_decorate([
    (0, _classvalidator.IsArray)(),
    (0, _classvalidator.ArrayNotEmpty)(),
    (0, _classvalidator.IsString)({
        each: true
    }),
    _ts_metadata("design:type", Array)
], AdminRoleDefinitionDto.prototype, "permissions", void 0);
let AdminRoleDefinitionCreateWsDto = class AdminRoleDefinitionCreateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionCreateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(400),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionCreateWsDto.prototype, "description", void 0);
_ts_decorate([
    (0, _classvalidator.IsArray)(),
    (0, _classvalidator.ArrayNotEmpty)(),
    (0, _classvalidator.IsString)({
        each: true
    }),
    _ts_metadata("design:type", Array)
], AdminRoleDefinitionCreateWsDto.prototype, "permissions", void 0);
let AdminRoleDefinitionUpdateWsDto = class AdminRoleDefinitionUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionUpdateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(400),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionUpdateWsDto.prototype, "description", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsArray)(),
    (0, _classvalidator.ArrayNotEmpty)(),
    (0, _classvalidator.IsString)({
        each: true
    }),
    _ts_metadata("design:type", Array)
], AdminRoleDefinitionUpdateWsDto.prototype, "permissions", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionUpdateWsDto.prototype, "newName", void 0);
let AdminRoleDefinitionDeleteWsDto = class AdminRoleDefinitionDeleteWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    _ts_metadata("design:type", String)
], AdminRoleDefinitionDeleteWsDto.prototype, "name", void 0);
let AdminBotNamesListWsDto = class AdminBotNamesListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminBotNamesListWsDto.prototype, "_noop", void 0);
let AdminBotNameCreateWsDto = class AdminBotNameCreateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(150),
    _ts_metadata("design:type", String)
], AdminBotNameCreateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminBotNameCreateWsDto.prototype, "enabled", void 0);
let AdminBotNameUpdateWsDto = class AdminBotNameUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], AdminBotNameUpdateWsDto.prototype, "id", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(150),
    _ts_metadata("design:type", String)
], AdminBotNameUpdateWsDto.prototype, "name", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminBotNameUpdateWsDto.prototype, "enabled", void 0);
let AdminBotNameDeleteWsDto = class AdminBotNameDeleteWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], AdminBotNameDeleteWsDto.prototype, "id", void 0);
let AdminBotSettingsGetWsDto = class AdminBotSettingsGetWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminBotSettingsGetWsDto.prototype, "_noop", void 0);
let AdminBotSettingsUpdateWsDto = class AdminBotSettingsUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    _ts_metadata("design:type", Number)
], AdminBotSettingsUpdateWsDto.prototype, "botTurnDelayMs", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    _ts_metadata("design:type", Number)
], AdminBotSettingsUpdateWsDto.prototype, "botStartDelayMs", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    _ts_metadata("design:type", Number)
], AdminBotSettingsUpdateWsDto.prototype, "botDrawDelayMs", void 0);
