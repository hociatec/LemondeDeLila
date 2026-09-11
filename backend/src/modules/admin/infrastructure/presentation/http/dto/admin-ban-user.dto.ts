import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class AdminBanUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  durationDays?: number;

  @IsOptional()
  @IsDateString()
  @MaxLength(64)
  bannedUntil?: string | null;
}
