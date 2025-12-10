import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

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
