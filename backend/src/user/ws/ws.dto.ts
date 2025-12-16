import { IsInt, IsPositive } from 'class-validator';

export class UserGetDto {
  @IsInt()
  @IsPositive()
  id!: number;
}

