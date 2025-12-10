import { IsString, MinLength } from 'class-validator';

export class AuthLoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(3)
  password!: string;
}
