import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RoomsPublicListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType?: string;
}

export class RoomsPublicJoinDto {
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  roomId!: number;
}
