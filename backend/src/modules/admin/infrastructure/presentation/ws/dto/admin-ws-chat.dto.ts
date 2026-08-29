import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminChatMessagesWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}

export class AdminChatSettingsGetWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminChatSettingsUpdateWsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  chatHistoryLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  editWindowSeconds?: number;
}

export class AdminChatDeleteWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  messageId!: string;
}

export class AdminChatClearWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}
