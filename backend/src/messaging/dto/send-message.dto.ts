import { IsInt, IsNotEmpty, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @IsInt()
  @Min(1)
  recipientId!: number;

  @IsNotEmpty()
  @MaxLength(1000)
  text!: string;
}
