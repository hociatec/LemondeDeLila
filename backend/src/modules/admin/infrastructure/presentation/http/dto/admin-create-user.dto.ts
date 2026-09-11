import {
  IsArray,
  ArrayMaxSize,
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
} from '../../../../../user/public-api';

export class AdminCreateUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^(?![0-9])[A-Za-z0-9_-]+$/, {
    message:
      "Le nom d'utilisateur ne peut contenir que lettres, chiffres, _ et -, et ne peut pas commencer par un chiffre",
  })
  username!: string;

  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @MinLength(1, { each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string | null;
}
