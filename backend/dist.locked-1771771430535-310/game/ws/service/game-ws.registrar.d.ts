import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../common/ws/ws-route-registry.service';
import { GameWsHandler } from './game-ws.handler';
export declare class GameWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    constructor(registry: WsRouteRegistry, handler: GameWsHandler);
    onModuleInit(): void;
}
