import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { type SessionStateStore } from '../../common/session/session-store.interface';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { WsApiHubService } from '../../common/ws/ws-api-hub.service';
export declare class RealtimeApiGateway implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket> {
    private readonly registry;
    private readonly auth;
    private readonly sessionStore;
    private readonly clientUpdates;
    private readonly wsTickets;
    private readonly hub;
    server: Server<WebSocket>;
    private readonly clients;
    private readonly logger;
    constructor(registry: WsRouteRegistry, auth: WsJwtAuthService, sessionStore: SessionStateStore, clientUpdates: ClientUpdatesService, wsTickets: WsTicketAuthService, hub: WsApiHubService);
    handleConnection(client: WebSocket, ...args: any[]): Promise<void>;
    handleDisconnect(client: WebSocket): void;
    private handleIncoming;
    private decode;
    private safeSend;
    private sendError;
    private formatError;
}
