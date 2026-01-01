import { IsBoolean, IsInt, Min } from 'class-validator';

export class AdminRoomsDestroyWsDto {
  @IsInt()
  @Min(1)
  roomId!: number;

  @IsBoolean()
  confirm!: boolean;
}

