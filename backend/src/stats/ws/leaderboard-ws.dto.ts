import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class LeaderboardTopDto {
  @IsString()
  @MaxLength(100)
  gameType!: string;

  @IsOptional()
  @IsBoolean()
  withBots?: boolean;
}

