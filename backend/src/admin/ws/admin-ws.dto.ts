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
}

export class AdminGameResetWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;
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
