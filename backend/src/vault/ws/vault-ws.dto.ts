import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class VaultSaveWsDto {
  @IsInt()
  @Min(1)
  roomId!: number;
}

export class VaultIdWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;
}

