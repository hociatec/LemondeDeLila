import { IsString, MinLength } from 'class-validator';

export class GameRulesDto {
  @IsString()
  @MinLength(1)
  gameType!: string;
}

