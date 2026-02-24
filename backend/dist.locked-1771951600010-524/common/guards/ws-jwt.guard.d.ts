import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class WsJwtGuard implements CanActivate {
    private readonly config;
    constructor(config: ConfigService);
    canActivate(context: ExecutionContext): boolean;
    private extractBearer;
    private extractQueryTokenFromAuth;
    private extractQueryToken;
    private verify;
}
