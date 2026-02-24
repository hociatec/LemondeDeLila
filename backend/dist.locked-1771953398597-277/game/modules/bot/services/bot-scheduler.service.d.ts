export declare class BotSchedulerService {
    private readonly timers;
    has(key: string): boolean;
    clear(key: string): void;
    schedule(params: {
        key: string;
        delayMs: number;
        roomId: number;
        gameType: string;
        run: () => Promise<void>;
        onStale?: (err: unknown) => void;
    }): void;
    private isRoomNotFound;
}
