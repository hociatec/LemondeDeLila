import {
  IsBoolean,
  IsInt,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class RoomInviteSendDto {
  @IsInt()
  @IsPositive()
  roomId!: number;

  @IsInt()
  @IsPositive()
  userId!: number;
}

export class RoomInviteRespondDto {
  @IsString()
  @MinLength(10)
  invitationId!: string;

  @IsBoolean()
  accept!: boolean;
}
