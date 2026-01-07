import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminListUsersWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsOptional()
  @IsIn(['all', 'active', 'banned'])
  status?: 'all' | 'active' | 'banned';

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AdminRolesListWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminUserIdWsDto {
  @IsInt()
  @IsPositive()
  id!: number;
}

export class AdminBanUserWsDto extends AdminUserIdWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsString()
  bannedUntil?: string | null;
}

export class AdminBroadcastWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

export class AdminClientUpdateAnnounceWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

export class AdminClientUpdateForceLatestWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class AdminChatMessagesWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}

export class AdminChatSettingsGetWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminChatSettingsUpdateWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  chatHistoryLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  editWindowSeconds?: number;
}

export class AdminChatDeleteWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  messageId!: string;
}

export class AdminChatClearWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminPerfSnapshotWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  windowSeconds?: number;
}

export class AdminChatBanWsDto extends AdminUserIdWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
}

export class AdminChatUnbanWsDto extends AdminUserIdWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminGameSetEnabledWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class AdminGameUpdateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  chatSoundsEnabled?: boolean;
}

export class AdminGameResetWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;
}

export class AdminGameCategoriesListWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminGameCategoryCreateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentId?: string | null;
}

export class AdminGameCategoryUpdateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  id!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentId?: string | null;
}

export class AdminGameCategoryAssignWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryId?: string | null;
}

export class AdminUserRolesWsDto {
  @IsInt()
  @IsPositive()
  id!: number;

  @IsArray()
  roles!: string[];
}

export class AdminLogsDownloadWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  lines?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  filter?: string;
}

export class AdminRoleDefinitionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions!: string[];
}

export class AdminRoleDefinitionCreateWsDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions!: string[];
}

export class AdminRoleDefinitionUpdateWsDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  newName?: string;
}

export class AdminRoleDefinitionDeleteWsDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class AdminBotNamesListWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminBotNameCreateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AdminBotNameUpdateWsDto {
  @IsInt()
  @IsPositive()
  id!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AdminBotNameDeleteWsDto {
  @IsInt()
  @IsPositive()
  id!: number;
}

export class AdminBotSettingsGetWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminBotSettingsUpdateWsDto {
  @IsInt()
  @Min(0)
  botTurnDelayMs!: number;
}
