import type { RoomInvite } from '../models/room-invite.model';

export const ROOM_INVITE_REPOSITORY = Symbol('ROOM_INVITE_REPOSITORY');

export interface RoomInviteRepository {
  save(invite: RoomInvite): Promise<void>;
  findValidById(id: string, nowMs: number): Promise<RoomInvite | null>;
  findActive(
    roomId: number,
    toUserId: number,
    nowMs: number,
  ): Promise<RoomInvite | null>;
  findActiveRecipientIds(
    roomId: number,
    userIds: readonly number[],
    nowMs: number,
  ): Promise<number[]>;
  consume(
    id: string,
    consumedAtMs: number,
    nowMs: number,
    keep: boolean,
  ): Promise<RoomInvite | null>;
  delete(id: string): Promise<void>;
  deleteExpired(nowMs: number, limit: number): Promise<void>;
  canSpectate(roomId: number, userId: number, nowMs: number): Promise<boolean>;
}
