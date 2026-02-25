export declare class MessagingConversationDto {
    userId: number;
    limit?: number;
}
export declare class MessagingListDto {
    box?: string;
    limit?: number;
}
export declare class MessagingSendDto {
    recipientId: number;
    text: string;
    subject?: string;
}
export declare class MessagingSearchDto {
    username?: string;
    query?: string;
}
export declare class MessagingMarkReadDto {
    messageId: string;
}
