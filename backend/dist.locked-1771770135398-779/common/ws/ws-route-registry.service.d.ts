import type { WsAuthPayload } from '../interfaces/ws-auth-payload';
export type WsIncomingMessage = {
    type?: string;
    payload?: any;
    requestId?: string;
};
export type WsSession = {
    user: WsAuthPayload | null;
    connectionId: string;
};
export type WsRouteHandler = (session: WsSession, payload: any) => Promise<{
    type: string;
    payload: any;
} | null>;
export declare class WsRouteRegistry {
    private readonly routes;
    register(type: string, handler: WsRouteHandler): void;
    get(type: string): WsRouteHandler | undefined;
    has(type: string): boolean;
    listTypes(): string[];
}
