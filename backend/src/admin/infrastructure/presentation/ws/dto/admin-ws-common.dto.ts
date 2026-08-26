import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminUserIdWsDto {
  @IsInt()
  @IsPositive()
  id!: number;
}

export class AdminRolesListWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminBroadcastWsDto {
  @IsString()
  @Min(1)
  @MaxLength(2000)
  message!: string;
}

export class AdminPerfSnapshotWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  windowSeconds?: number;
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

export class AdminUserRolesWsDto {
  @IsInt()
  @IsPositive()
  id!: number;

  @IsArray()
  roles!: string[];
}
