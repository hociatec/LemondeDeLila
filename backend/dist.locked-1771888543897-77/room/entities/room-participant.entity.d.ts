import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';
export declare class RoomParticipant {
    id: number;
    room: Room;
    user: User;
    role: string;
    joinedAt: Date;
    leftAt?: Date | null;
}
