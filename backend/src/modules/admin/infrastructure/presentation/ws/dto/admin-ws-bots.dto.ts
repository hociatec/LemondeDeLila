import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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
  @Max(2147483647)
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
  @Max(2147483647)
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
  @Max(600000)
  botTurnDelayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600000)
  botStartDelayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600000)
  botDrawDelayMs?: number;
}
