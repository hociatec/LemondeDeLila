import type { WsAuthPayload } from '../interfaces/ws-auth-payload';
export type WsSession = {
    user: WsAuthPayload | null;
};
export declare function requireUser(session: WsSession): WsAuthPayload;
export declare function requireAdmin(session: WsSession): WsAuthPayload;
