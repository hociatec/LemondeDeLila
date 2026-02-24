import type { SessionState, SessionStateStore } from './session-store.interface';
export declare class RedisSessionStore implements SessionStateStore {
    private readonly logger;
    private readonly redis;
    private readonly prefix;
    constructor(redisUrl: string);
    save(connectionId: string, state: SessionState): Promise<void>;
    get(connectionId: string): Promise<SessionState | null>;
    delete(connectionId: string): Promise<void>;
}
