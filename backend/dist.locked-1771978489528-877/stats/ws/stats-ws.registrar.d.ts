import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { StatsWsHandler } from './stats-ws.handler';
export declare class StatsWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    constructor(registry: WsRouteRegistry, handler: StatsWsHandler);
    onModuleInit(): void;
}
