export declare class AdminMaintenanceService {
    private readonly backendCwd;
    startBuildAndRestartBackend(): {
        ok: boolean;
        service: string;
        scheduled: boolean;
    };
    startDeploy(): {
        ok: boolean;
        unit: string;
    };
    startRestartBackend(): {
        ok: boolean;
        service: string;
        scheduled: boolean;
    };
    daemonReload(): {
        status: number;
        stdout: string;
        stderr: string;
        error: string | null;
        ok: boolean;
        command: string;
    };
    dryRunBuild(): {
        status: number;
        stdout: string;
        stderr: string;
        error: string | null;
        ok: boolean;
        command: string;
    };
    runMigrations(): {
        status: number;
        stdout: string;
        stderr: string;
        error: string | null;
        ok: boolean;
        command: string;
    };
    getHealth(): Promise<{
        ok: true;
        url: string;
        statusCode: number;
        body: string;
    }>;
    getDeployStatus(): {
        ok: boolean;
        unit: string;
    };
    getBackendServiceStatus(): {
        ok: boolean;
        unit: string;
    };
    getDeployLogs(input: {
        tail?: string;
    }): {
        ok: boolean;
        unit: string;
        tail: number;
        logs: string;
    };
    private getUnitStatus;
    private parseSystemctlShow;
    private parseTail;
    private run;
    private spawnDetached;
    private shQuote;
    private httpGet;
}
