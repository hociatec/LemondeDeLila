import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class GameRulesDto {
  @IsString()
  @MinLength(1)
  gameType!: string;

  // Allow client trace metadata (whitelist validation).
  @IsOptional()
  @IsObject()
  _trace?: Record<string, unknown>;
}
