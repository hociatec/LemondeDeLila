import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

export class AdminClientUpdateScheduleWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  delayMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  delaySeconds?: number;
}




