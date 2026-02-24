import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { RoomDirectoryWsHandler } from './room-directory-ws.handler';
export declare class RoomWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    constructor(registry: WsRouteRegistry, handler: RoomDirectoryWsHandler);
    onModuleInit(): void;
}
