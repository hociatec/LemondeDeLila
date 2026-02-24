import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { SocialWsHandler } from './social-ws.handler';
export declare class SocialWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly handler;
    constructor(registry: WsRouteRegistry, handler: SocialWsHandler);
    onModuleInit(): void;
}
