import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength, Min, MinLength } from 'class-validator';

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
  @IsOptional()
  @IsInt()
  @Min(0)
  botTurnDelayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  botStartDelayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  botDrawDelayMs?: number;
}




