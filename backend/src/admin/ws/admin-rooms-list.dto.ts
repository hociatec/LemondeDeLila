import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class AdminRoomsListWsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsBoolean()
  @IsOptional()
  includePrivate?: boolean;

  @IsBoolean()
  @IsOptional()
  includeStarted?: boolean;

  /**
   * When true, only return rooms that are "open/joinable" and have at least one active player socket.
   * Used by the admin "Intégrer une room" flow to avoid listing empty/ghost tables.
   */
  @IsBoolean()
  @IsOptional()
  joinableOnly?: boolean;
}
