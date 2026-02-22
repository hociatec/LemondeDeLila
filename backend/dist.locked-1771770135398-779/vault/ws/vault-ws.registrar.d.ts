import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { VaultWsHandler } from './vault-ws.handler';
export declare class VaultWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    constructor(registry: WsRouteRegistry, handler: VaultWsHandler);
    onModuleInit(): void;
}
