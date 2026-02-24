import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
export declare class ApiCapabilitiesWsRegistrar implements OnModuleInit {
    private readonly registry;
    constructor(registry: WsRouteRegistry);
    onModuleInit(): void;
}
