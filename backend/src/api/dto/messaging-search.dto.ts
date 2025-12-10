import { IsOptional, IsString, MaxLength } from 'class-validator';

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
