import { Injectable } from '@nestjs/common';
import { parseStrictInteger } from '@shared/utils/public-api';
import type { RoomPayload } from '../../models/room-payload.model';
import {
  RoomInvalidRoomIdError,
  RoomInvalidUserIdError,
  RoomOwnerRequiredError,
  RoomUserNotOnTableError,
} from '../../../domain/errors/room-domain.errors';

@Injectable()
export class RoomAdminPolicyService {
  requireValidRoomId(roomId: number): number {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new RoomInvalidRoomIdError();
    }

    return roomId;
  }

  requireTargetUserId(
    row: Record<string, unknown>,
    candidateKeys: readonly string[],
  ): number {
    if (!Array.isArray(candidateKeys) || candidateKeys.length > 16) {
      throw new RoomInvalidUserIdError();
    }
    const targetRaw = candidateKeys
      .map((key): unknown => Reflect.get(row, key))
      .find((value) => value !== undefined && value !== null);
    const targetUserId = parseStrictInteger(targetRaw, { min: 1 });
    if (targetUserId === null) {
      throw new RoomInvalidUserIdError();
    }

    return targetUserId;
  }

  ensureUserIsOnTable(input: {
    state: RoomPayload | null | undefined;
    userId: number;
    spectatorIds: readonly number[];
    hasUserConnections: boolean;
  }): void {
    if (
      !input ||
      !Number.isSafeInteger(input.userId) ||
      input.userId <= 0 ||
      !Array.isArray(input.spectatorIds) ||
      input.spectatorIds.length > 10_000
    ) {
      throw new RoomUserNotOnTableError();
    }
    const isOnTable =
      (input.state?.room?.players?.some(
        (player) => player?.id === input.userId,
      ) ??
        false) ||
      input.spectatorIds.includes(input.userId) ||
      input.hasUserConnections;

    if (!isOnTable) {
      throw new RoomUserNotOnTableError();
    }
  }

  requireOwnerActionState(
    state: RoomPayload,
    userId: number,
    ownerErrorMessage: string,
  ): RoomPayload {
    const ownerId = state?.room?.owner?.id ?? 0;
    if (ownerId !== userId) {
      throw new RoomOwnerRequiredError(ownerErrorMessage);
    }

    return state;
  }
}
/** Room application capability boundary. */
