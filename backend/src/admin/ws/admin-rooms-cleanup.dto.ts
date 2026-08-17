import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminRoomsCleanupWsDto {
  @IsBoolean()
  confirm!: boolean;

  @IsOptional()
  @IsBoolean()
  includePrivate?: boolean;

  @IsOptional()
  @IsBoolean()
  includeStarted?: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365 * 24 * 60)
  olderThanMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}


