import {
  IsBoolean,
  IsInt,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
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
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  invitationId!: string;

  @IsBoolean()
  accept!: boolean;
}

export class RoomInvitePresenceListDto {
  @IsInt()
  @IsPositive()
  roomId!: number;
}
