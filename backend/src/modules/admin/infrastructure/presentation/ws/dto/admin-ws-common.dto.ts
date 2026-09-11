import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  Max,
  MinLength,
  Min,
} from 'class-validator';

export class AdminUserIdWsDto {
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  id!: number;
}

export class AdminRolesListWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminBroadcastWsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

export class AdminPerfSnapshotWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  windowSeconds?: number;
}

export class AdminLogsDownloadWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  lines?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  filter?: string;
}

export class AdminUserRolesWsDto {
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  id!: number;

  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @MinLength(1, { each: true })
  roles!: string[];
}
