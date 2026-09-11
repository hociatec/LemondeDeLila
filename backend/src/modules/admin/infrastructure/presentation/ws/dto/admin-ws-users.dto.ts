import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminUserIdWsDto } from './admin-ws-common.dto';

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
  @Max(100000)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminBanUserWsDto extends AdminUserIdWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  durationDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bannedUntil?: string | null;
}

export class AdminChatBanWsDto extends AdminUserIdWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  durationDays?: number;
}

export class AdminChatUnbanWsDto extends AdminUserIdWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}
