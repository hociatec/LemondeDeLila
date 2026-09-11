import { StrictIntegerInput } from '../../../../../../platform/validation/public-api';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminListUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;

  @IsOptional()
  @IsIn(['all', 'active', 'banned'])
  status: 'all' | 'active' | 'banned' = 'all';

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @StrictIntegerInput()
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @StrictIntegerInput()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
