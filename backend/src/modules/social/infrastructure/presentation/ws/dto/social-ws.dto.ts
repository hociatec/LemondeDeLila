import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SocialUserIdDto {
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  userId!: number;
}

export class SocialListDto {
  @IsOptional()
  @IsBoolean()
  includeBlocked?: boolean;
}

export class SocialRequestListDto extends SocialListDto {
  @IsOptional()
  @IsIn(['incoming', 'outgoing', 'all'])
  direction?: string;
}

export class SocialProfileGetDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  userId?: number;
}

export class SocialProfileUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  victoryMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  defeatMessage?: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'friends', 'private'])
  visibility?: string;
}

export class SocialSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  query!: string;
}
