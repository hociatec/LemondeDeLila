import { IsInt, Min } from 'class-validator';

export class StatsUserDto {
  @IsInt()
  @Min(1)
  userId!: number;
}

