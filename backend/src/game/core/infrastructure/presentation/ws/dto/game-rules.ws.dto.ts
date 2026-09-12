import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GameRulesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  gameType!: string;

  // Allow client trace metadata (whitelist validation).
  @IsOptional()
  @IsObject()
  _trace?: Record<string, unknown>;
}
