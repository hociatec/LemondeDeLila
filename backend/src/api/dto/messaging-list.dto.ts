import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

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
