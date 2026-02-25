import { User } from '../../user/entities/user.entity';
export declare class PrivateMessage {
    id: number;
    sender: User;
    recipient: User;
    messageId: string;
    message: string;
    subject?: string | null;
    createdAt: Date;
    deletedBySenderAt?: Date | null;
    deletedByRecipientAt?: Date | null;
    readByRecipientAt?: Date | null;
}
