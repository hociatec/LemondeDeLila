import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../models/room-payload.model';
import {
  RoomWsInvalidRoomIdError,
  RoomWsInvalidUserIdError,
  RoomWsOwnerRequiredError,
  RoomWsUserNotOnTableError,
} from '../../domain/errors/room-ws.errors';

@Injectable()
export class RoomAdminPolicyService {
  requireValidRoomId(roomId: number): number {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new RoomWsInvalidRoomIdError();
    }

    return roomId;
  }

  requireTargetUserId(
    row: Record<string, unknown>,
    candidateKeys: readonly string[],
  ): number {
    const targetRaw = candidateKeys
      .map((key) => row[key])
      .find((value) => value !== undefined && value !== null);
    const targetUserId = Number(targetRaw);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      throw new RoomWsInvalidUserIdError();
    }

    return targetUserId;
  }

  ensureUserIsOnTable(input: {
    state: RoomPayload | null | undefined;
    userId: number;
    spectatorIds: readonly number[];
    hasUserConnections: boolean;
  }): void {
    const isOnTable =
      (input.state?.room?.players?.some(
        (player) => player?.id === input.userId,
      ) ??
        false) ||
      input.spectatorIds.includes(input.userId) ||
      input.hasUserConnections;

    if (!isOnTable) {
      throw new RoomWsUserNotOnTableError();
    }
  }

  requireOwnerActionState(
    state: RoomPayload,
    userId: number,
    ownerErrorMessage: string,
  ): RoomPayload {
    const ownerId = state?.room?.owner?.id ?? 0;
    if (ownerId !== userId) {
      throw new RoomWsOwnerRequiredError(ownerErrorMessage);
    }

    return state;
  }
}
