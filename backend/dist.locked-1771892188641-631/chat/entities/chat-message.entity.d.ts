import { User } from '../../user/entities/user.entity';
export declare class ChatMessage {
    id: number;
    user: User;
    messageId: string;
    message: string;
    createdAt: Date;
    deletedAt: Date | null;
}
