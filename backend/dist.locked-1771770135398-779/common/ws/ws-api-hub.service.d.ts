type WsSocketLike = {
    readyState: number;
    send(data: string, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
};
export declare class WsApiHubService {
    private readonly logger;
    private readonly socketsByConnectionId;
    register(connectionId: string, socket: WsSocketLike): void;
    unregister(connectionId: string): void;
    send(connectionId: string, message: unknown): boolean;
}
export {};
