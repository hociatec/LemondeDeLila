import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { CatalogWsHandler } from './catalog-ws.handler';
export declare class CatalogWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    private readonly logger;
    constructor(registry: WsRouteRegistry, handler: CatalogWsHandler);
    onModuleInit(): void;
}
