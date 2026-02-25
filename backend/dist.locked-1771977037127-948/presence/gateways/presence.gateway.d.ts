import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { PresenceService } from '../services/presence.service';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
export declare class PresenceGateway implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket> {
    private readonly presence;
    private readonly auth;
    private readonly wsTickets;
    server: Server<WebSocket>;
    private readonly logger;
    constructor(presence: PresenceService, auth: WsJwtAuthService, wsTickets: WsTicketAuthService);
    handleConnection(client: WebSocket, ...args: any[]): Promise<void>;
    handleDisconnect(client: WebSocket): void;
    private handleIncoming;
    private resolveAuth;
    private resolveContext;
}
