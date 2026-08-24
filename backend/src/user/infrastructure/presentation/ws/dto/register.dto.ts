import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^(?![0-9])[A-Za-z0-9_-]+$/, {
    message:
      "Le nom d'utilisateur ne peut contenir que lettres, chiffres, _ et -, et ne peut pas commencer par un chiffre",
  })
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
