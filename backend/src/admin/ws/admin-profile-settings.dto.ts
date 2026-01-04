import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminProfileSettingsGetWsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  _noop?: number;
}

export class AdminProfileSettingsUpdateWsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  bioMinLength?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  bioMaxLength?: number;
}

