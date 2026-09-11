import {
  IsBoolean,
  IsInt,
  Max,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RoomInviteSendDto {
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  roomId!: number;

  @IsInt()
  @IsPositive()
  @Max(2147483647)
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
  @Max(2147483647)
  roomId!: number;
}
