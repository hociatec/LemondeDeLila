import { AdminMaintenanceService } from '../services/admin-maintenance.service';
export declare class AdminMaintenanceController {
    private readonly maintenance;
    constructor(maintenance: AdminMaintenanceService);
    health(): Promise<{
        ok: true;
        url: string;
        statusCode: number;
        body: string;
    }>;
    deploy(): {
        ok: boolean;
        unit: string;
    };
    dryRunBuild(): {
        status: number;
        stdout: string;
        stderr: string;
        error: string | null;
        ok: boolean;
        command: string;
    };
    migrationsRun(): {
        status: number;
        stdout: string;
        stderr: string;
        error: string | null;
        ok: boolean;
        command: string;
    };
    restartService(): {
        ok: boolean;
        service: string;
        scheduled: boolean;
    };
    buildAndRestartService(): {
        ok: boolean;
        service: string;
        scheduled: boolean;
    };
    systemdDaemonReload(): {
        status: number;
        stdout: string;
        stderr: string;
        error: string | null;
        ok: boolean;
        command: string;
    };
    deployStatus(): {
        ok: boolean;
        unit: string;
    };
    deployLogs(tail?: string): {
        ok: boolean;
        unit: string;
        tail: number;
        logs: string;
    };
    serviceStatus(): {
        ok: boolean;
        unit: string;
    };
}
