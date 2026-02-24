import { OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { NotificationTransport } from './notification-transport';
export declare class NotificationService implements OnModuleDestroy {
    private readonly transport;
    private readonly logger;
    private readonly socketsByUserId;
    private readonly instanceId;
    constructor(transport: NotificationTransport);
    onModuleDestroy(): Promise<void>;
    register(userId: number, socket: WebSocket): void;
    unregister(userId: number, socket: WebSocket): void;
    notifyUser(userId: number, type: string, payload: any): Promise<void>;
    notifyAll(type: string, payload: any): Promise<void>;
    disconnectAll(reason?: string): void;
    private handleExternalEvent;
    private dispatchToLocal;
    private dispatchToAllLocal;
}
