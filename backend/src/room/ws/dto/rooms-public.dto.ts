import { IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class RoomsPublicListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  gameType?: string;
}

export class RoomsPublicJoinDto {
  @IsInt()
  @IsPositive()
  roomId!: number;
}

