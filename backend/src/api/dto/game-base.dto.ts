import { IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class GameBaseDto {
  @IsInt()
  @IsPositive()
  roomId!: number;

  @IsString()
  @MinLength(1)
  gameType!: string;
}

export class GameActionsDto extends GameBaseDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  playerId?: number;
}
