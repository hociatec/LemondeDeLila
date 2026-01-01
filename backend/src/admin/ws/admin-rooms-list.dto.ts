import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class AdminRoomsListWsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsBoolean()
  @IsOptional()
  includePrivate?: boolean;

  @IsBoolean()
  @IsOptional()
  includeStarted?: boolean;
}

