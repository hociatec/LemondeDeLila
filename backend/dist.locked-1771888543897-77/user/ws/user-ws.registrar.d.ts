import { OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { AuthWsHandler } from './auth-ws.handler';
import { UserWsHandler } from './user-ws.handler';
export declare class UserWsRegistrar implements OnModuleInit {
    private readonly registry;
    private readonly auth;
    private readonly users;
    constructor(registry: WsRouteRegistry, auth: AuthWsHandler, users: UserWsHandler);
    onModuleInit(): void;
}
