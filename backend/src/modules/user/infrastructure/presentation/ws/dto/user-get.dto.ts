import { StrictIntegerInput } from '../../../../../../platform/validation/public-api';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class UserGetDto {
  @IsInt()
  @IsPositive()
  id!: number;
}

export class UserListDto {
  @IsOptional()
  @StrictIntegerInput()
  @IsInt()
  @Min(0)
  @Max(10000000)
  offset: number = 0;

  @IsOptional()
  @StrictIntegerInput()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
