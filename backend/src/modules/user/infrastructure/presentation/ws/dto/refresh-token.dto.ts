import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken!: string;

  @IsOptional()
  @IsBoolean()
  allSessions?: boolean;
}
