import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ClientUpdatesUploadMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  minRequiredVersion?: string;
}

export class ClientUpdatesUploadInitDto extends ClientUpdatesUploadMetaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalBytes?: number | null;
}

export class ClientUpdatesUploadChunkDto {
  @IsUUID()
  uploadId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;
}

export class ClientUpdatesUploadCompleteDto {
  @IsUUID()
  uploadId!: string;
}
