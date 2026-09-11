import { IsInt, Max, Min } from 'class-validator';

export class StatsUserDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId!: number;
}
