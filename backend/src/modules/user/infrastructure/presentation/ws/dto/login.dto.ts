import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(255)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  password!: string;
}
