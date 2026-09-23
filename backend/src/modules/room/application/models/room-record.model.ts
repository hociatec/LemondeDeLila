import type { RoomBotRecord } from './room-bot.model';
import type { RoomParticipantRecord } from './room-participant.model';
import type { RoomUserRecord } from './room-user.model';

export type RoomRecord = {
  id: number;
  name: string;
  gameType: string;
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
  owner: RoomUserRecord | null;
  createdAt: Date;
  startedAt: Date | null;
  runId: number;
  tableAmbienceSoundId: string | null;
  restoredFromSnapshotId: string | null;
  restoredOwnerUserId: number | null;
  participants: RoomParticipantRecord[];
  bots: RoomBotRecord[];
};
/** Explicitly named data contract at the application boundary. */
