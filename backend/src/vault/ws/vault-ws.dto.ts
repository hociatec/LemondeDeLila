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

  // Optional: si fourni, met à jour cette sauvegarde (au lieu d'en créer une nouvelle).
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
