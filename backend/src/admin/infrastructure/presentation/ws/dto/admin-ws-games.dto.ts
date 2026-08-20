import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AdminGameSetEnabledWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class AdminGameUpdateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  rules?: string;

  @IsOptional()
  @IsIn(['construction', 'beta', 'finished'])
  status?: 'construction' | 'beta' | 'finished';

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  chatSoundsEnabled?: boolean;
}

export class AdminGameResetWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;
}

export class AdminGameCategoriesListWsDto {
  @IsOptional()
  @IsBoolean()
  _noop?: boolean;
}

export class AdminGameCategoryCreateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentId?: string | null;
}

export class AdminGameCategoryUpdateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  id!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentId?: string | null;
}

export class AdminGameCategoryAssignWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryId?: string | null;
}

export class AdminGameCategoryDeleteWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  id!: string;
}




