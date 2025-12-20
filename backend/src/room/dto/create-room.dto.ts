import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MaxLength(255)
  gameType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number | null;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
