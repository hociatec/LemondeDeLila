import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class MessagingConversationDto {
  @IsInt()
  @IsPositive()
  userId!: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class MessagingListDto {
  @IsOptional()
  @IsIn(['inbox', 'received', '', 'sent', 'outbox', 'deleted', 'trash'])
  box?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class MessagingSendDto {
  @IsInt()
  @IsPositive()
  recipientId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}

export class MessagingSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;
}

export class MessagingMarkReadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  messageId!: string;
}
