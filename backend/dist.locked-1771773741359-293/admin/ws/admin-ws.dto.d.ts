export declare class AdminListUsersWsDto {
    search?: string;
    role?: string;
    status?: 'all' | 'active' | 'banned';
    createdAfter?: string;
    createdBefore?: string;
    page?: number;
    limit?: number;
}
export declare class AdminRolesListWsDto {
    _noop?: boolean;
}
export declare class AdminUserIdWsDto {
    id: number;
}
export declare class AdminBanUserWsDto extends AdminUserIdWsDto {
    reason: string;
    durationDays?: number;
    bannedUntil?: string | null;
}
export declare class AdminBroadcastWsDto {
    message: string;
}
export declare class AdminClientUpdateAnnounceWsDto {
    message?: string;
    version?: string;
}
export declare class AdminClientUpdateForceLatestWsDto {
    message?: string;
}
export declare class AdminClientUpdateScheduleWsDto {
    message?: string;
    delayMinutes?: number;
    delaySeconds?: number;
}
export declare class AdminChatMessagesWsDto {
    limit?: number;
    includeDeleted?: boolean;
}
export declare class AdminChatSettingsGetWsDto {
    _noop?: boolean;
}
export declare class AdminChatSettingsUpdateWsDto {
    chatHistoryLimit?: number;
    editWindowSeconds?: number;
}
export declare class AdminChatDeleteWsDto {
    messageId: string;
}
export declare class AdminChatClearWsDto {
    _noop?: boolean;
}
export declare class AdminPerfSnapshotWsDto {
    windowSeconds?: number;
}
export declare class AdminChatBanWsDto extends AdminUserIdWsDto {
    reason?: string;
    durationDays?: number;
}
export declare class AdminChatUnbanWsDto extends AdminUserIdWsDto {
    _noop?: boolean;
}
export declare class AdminGameSetEnabledWsDto {
    gameType: string;
    enabled: boolean;
}
export declare class AdminGameUpdateWsDto {
    gameType: string;
    enabled?: boolean;
    minPlayers?: number;
    maxPlayers?: number;
    name?: string;
    description?: string;
    rules?: string;
    status?: 'construction' | 'beta' | 'finished';
    chatEnabled?: boolean;
    chatSoundsEnabled?: boolean;
}
export declare class AdminGameResetWsDto {
    gameType: string;
}
export declare class AdminGameCategoriesListWsDto {
    _noop?: boolean;
}
export declare class AdminGameCategoryCreateWsDto {
    name: string;
    parentId?: string | null;
}
export declare class AdminGameCategoryUpdateWsDto {
    id: string;
    name?: string;
    parentId?: string | null;
}
export declare class AdminGameCategoryAssignWsDto {
    gameType: string;
    categoryId?: string | null;
}
export declare class AdminGameCategoryDeleteWsDto {
    id: string;
}
export declare class AdminUserRolesWsDto {
    id: number;
    roles: string[];
}
export declare class AdminLogsDownloadWsDto {
    lines?: number;
    filter?: string;
}
export declare class AdminRoleDefinitionDto {
    name: string;
    description: string;
    permissions: string[];
}
export declare class AdminRoleDefinitionCreateWsDto {
    name: string;
    description: string;
    permissions: string[];
}
export declare class AdminRoleDefinitionUpdateWsDto {
    name: string;
    description?: string;
    permissions?: string[];
    newName?: string;
}
export declare class AdminRoleDefinitionDeleteWsDto {
    name: string;
}
export declare class AdminBotNamesListWsDto {
    _noop?: boolean;
}
export declare class AdminBotNameCreateWsDto {
    name: string;
    enabled?: boolean;
}
export declare class AdminBotNameUpdateWsDto {
    id: number;
    name?: string;
    enabled?: boolean;
}
export declare class AdminBotNameDeleteWsDto {
    id: number;
}
export declare class AdminBotSettingsGetWsDto {
    _noop?: boolean;
}
export declare class AdminBotSettingsUpdateWsDto {
    botTurnDelayMs?: number;
    botStartDelayMs?: number;
    botDrawDelayMs?: number;
}
