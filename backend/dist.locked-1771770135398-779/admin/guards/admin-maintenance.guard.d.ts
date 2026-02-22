import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class AdminMaintenanceGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
    private isEnabled;
    private isTokenRequired;
    private getIpAllowlist;
    private getRequestIp;
}
