import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../../../../domain/policies/user-credentials.policy';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  @Matches(/^(?![0-9])[A-Za-z0-9_-]+$/, {
    message:
      "Le nom d'utilisateur ne peut contenir que lettres, chiffres, _ et -, et ne peut pas commencer par un chiffre",
  })
  username!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
