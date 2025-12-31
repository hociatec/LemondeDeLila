import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminRoomsSettingsGetWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminRoomsSettingsUpdateWsDto {
  @IsOptional()
  @IsBoolean()
  autoCleanupEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(24 * 60)
  autoCleanupOlderThanMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(24 * 60 * 60)
  autoCleanupIntervalSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  autoCleanupLimit?: number;
}

