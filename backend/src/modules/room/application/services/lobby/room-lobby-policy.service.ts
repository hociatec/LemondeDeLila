import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoomPayload } from '../../contracts/room-payload.model';
import type { RoomRecord } from '../../contracts/room-record.model';
import type { RoomInvite } from '../membership/room-invite.service';

@Injectable()
export class RoomLobbyPolicyService {
  ensureGameTypeAllowed(
    gameType: string | undefined,
    allowedGameTypes: ReadonlySet<string>,
  ): boolean {
    if (!gameType) {
      return true;
    }
    return allowedGameTypes.has(gameType);
  }

  ensureNotBanned(isBanned: boolean): void {
    if (isBanned) {
      throw new ForbiddenException('Banni de cette table');
    }
  }

  ensureSpectatingAllowed(state: RoomPayload): void {
    if (state.room.isPrivate) {
      throw new ForbiddenException(
        'Spectateurs interdits sur les tables privees',
      );
    }
  }

  requireOwnedRoom(room: RoomRecord | null, userId: number): RoomRecord {
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    if (!room.owner || room.owner.id !== userId) {
      throw new ForbiddenException('Seul le proprietaire peut inviter');
    }
    return room;
  }

  requireInviteRecipient(
    invite: RoomInvite | null,
    userId: number,
  ): RoomInvite | null {
    if (!invite) {
      return null;
    }
    if (invite.toUserId !== userId) {
      throw new ForbiddenException('Invitation non destinee a cet utilisateur');
    }
    return invite;
  }
}
/** Room application capability boundary. */
