import { WsRouteRegistry } from './ws-route-registry.service';
export declare class WsCapabilitiesController {
    private readonly routes;
    constructor(routes: WsRouteRegistry);
    getCapabilities(): {
        ws: {
            types: string[];
        };
    };
}
