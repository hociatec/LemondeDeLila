import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class VaultSaveWsDto {
  @IsInt()
  @Min(1)
  roomId!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id?: string;
}

export class VaultIdWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;
}

export class VaultAbandonWsDto {
  @IsInt()
  @Min(1)
  roomId!: number;
}
