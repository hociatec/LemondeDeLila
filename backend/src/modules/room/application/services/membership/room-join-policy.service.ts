import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../contracts/room-payload.model';
import { RoomWsInvalidRoomIdError } from '../../../domain/errors/room-ws.errors';

@Injectable()
export class RoomJoinPolicyService {
  /** Validates transport identity before membership orchestration. */
  requireValidRoomId(roomId: number): number {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new RoomWsInvalidRoomIdError();
    }
    return roomId;
  }

  isBanned(isBanned: boolean): boolean {
    return isBanned;
  }

  canUseSilentMode(isAdmin: boolean): boolean {
    return isAdmin;
  }

  shouldValidateSpectatorAccess(
    effectiveSpectator: boolean,
    effectiveSilent: boolean,
  ): boolean {
    return effectiveSpectator && !effectiveSilent;
  }

  shouldFallbackToSpectator(state: RoomPayload, userId: number): boolean {
    const isOwner = state.room.owner?.id === userId;
    const isParticipant =
      state.room.players?.some((player) => player?.id === userId) ?? false;
    const started =
      (state.room.status || '').toLowerCase() === 'started' ||
      Boolean(state.room.startedAt);
    return started && !isOwner && !isParticipant;
  }
}
