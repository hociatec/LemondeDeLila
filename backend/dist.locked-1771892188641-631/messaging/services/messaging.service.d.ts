import { Repository } from 'typeorm';
import { PrivateMessage } from '../entities/private-message.entity';
import { User } from '../../user/entities/user.entity';
import { MessageValidatorService } from './message-validator.service';
import { SendMessageDto } from '../dto/send-message.dto';
export type MessageUserDto = {
    id: number;
    username: string;
};
export type MessageDto = {
    id: string;
    sender: MessageUserDto;
    recipient: MessageUserDto;
    text: string;
    subject: string | null;
    createdAt: string;
    direction: 'sent' | 'received';
    deletedAt: string | null;
    boxType: 'inbox' | 'outbox' | 'deleted';
};
export declare class MessagingService {
    private readonly messages;
    private readonly users;
    private readonly validator;
    private static readonly DEFAULT_HISTORY_LIMIT;
    constructor(messages: Repository<PrivateMessage>, users: Repository<User>, validator: MessageValidatorService);
    send(senderId: number, payload: SendMessageDto): Promise<MessageDto>;
    conversation(currentId: number, otherUserId: number, limit?: number): Promise<MessageDto[]>;
    inbox(userId: number, limit?: number): Promise<MessageDto[]>;
    outbox(userId: number, limit?: number): Promise<MessageDto[]>;
    deleted(userId: number, limit?: number): Promise<MessageDto[]>;
    delete(userId: number, messageId: string): Promise<MessageDto>;
    restore(userId: number, messageId: string): Promise<MessageDto>;
    purge(userId: number, messageId: string): Promise<MessageDto>;
    markRead(userId: number, messageId: string): Promise<void>;
    lookupUser(username: string): Promise<MessageUserDto | null>;
    private ensureUser;
    private toDto;
    private clampLimit;
    private generateMessageId;
}
