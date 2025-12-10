import { IsInt, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class MessagingSendDto {
  @IsInt()
  @IsPositive()
  recipientId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}
