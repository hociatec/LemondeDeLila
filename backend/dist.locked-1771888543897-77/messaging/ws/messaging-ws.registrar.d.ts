import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { MessagingWsHandler } from './messaging-ws.handler';
export declare class MessagingWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    constructor(registry: WsRouteRegistry, handler: MessagingWsHandler);
    onModuleInit(): void;
}
