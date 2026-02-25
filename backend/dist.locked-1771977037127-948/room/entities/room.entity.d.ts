import { User } from '../../user/entities/user.entity';
import { RoomParticipant } from './room-participant.entity';
import { RoomBot } from './room-bot.entity';
export declare class Room {
    id: number;
    name: string;
    gameType: string;
    maxPlayers: number;
    isPrivate: boolean;
    status: string;
    owner?: User | null;
    createdAt: Date;
    startedAt?: Date | null;
    runId: number;
    tableAmbienceSoundId?: string | null;
    restoredFromSnapshotId?: string | null;
    restoredOwnerUserId?: number | null;
    participants: RoomParticipant[];
    bots: RoomBot[];
}
