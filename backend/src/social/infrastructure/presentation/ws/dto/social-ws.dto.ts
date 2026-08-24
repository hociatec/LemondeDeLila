import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SocialUserIdDto {
  @IsInt()
  @IsPositive()
  userId!: number;
}

export class SocialRequestListDto {
  @IsOptional()
  @IsIn(['incoming', 'outgoing', 'all'])
  direction?: string;
}

export class SocialProfileGetDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number;
}

export class SocialProfileUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100000)
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
