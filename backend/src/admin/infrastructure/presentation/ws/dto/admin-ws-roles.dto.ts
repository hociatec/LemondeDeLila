import { ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminRoleDefinitionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions!: string[];
}

export class AdminRoleDefinitionCreateWsDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions!: string[];
}

export class AdminRoleDefinitionUpdateWsDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  newName?: string;
}

export class AdminRoleDefinitionDeleteWsDto {
  @IsString()
  @MinLength(1)
  name!: string;
}




