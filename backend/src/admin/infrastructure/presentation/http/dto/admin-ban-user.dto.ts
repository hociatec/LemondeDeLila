import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class AdminBanUserDto {
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsDateString()
  bannedUntil?: string | null;
}

