import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SendMessageDto {
  @IsInt()
  @Min(1)
  recipientId!: number;

  @IsNotEmpty()
  @MaxLength(1000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}
