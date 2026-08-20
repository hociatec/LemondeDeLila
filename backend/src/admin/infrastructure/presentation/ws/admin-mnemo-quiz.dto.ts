import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminMnemoQuizCategoriesListWsDto {
  @IsOptional()
  @IsString()
  _noop?: string;
}

export class AdminMnemoQuizCategoryCreateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class AdminMnemoQuizCategoryUpdateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class AdminMnemoQuizCategoryDeleteWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;
}

export class AdminMnemoQuizQuestionsListWsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryId?: string;

  @IsOptional()
  @IsIn(['validated', 'pending', 'to_edit', 'trash'])
  status?: 'validated' | 'pending' | 'to_edit' | 'trash';
}

export class AdminMnemoQuizQuestionCreateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(800)
  question!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  answers!: string[];

  @IsInt()
  @Min(0)
  @Max(3)
  correctIndex!: number;

  @IsOptional()
  @IsIn(['validated', 'pending', 'to_edit', 'trash'])
  status?: 'validated' | 'pending' | 'to_edit' | 'trash';
}

export class AdminMnemoQuizQuestionUpdateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(800)
  question?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  answers?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  correctIndex?: number;

  @IsOptional()
  @IsIn(['validated', 'pending', 'to_edit', 'trash'])
  status?: 'validated' | 'pending' | 'to_edit' | 'trash';
}

export class AdminMnemoQuizQuestionDeleteWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;
}






