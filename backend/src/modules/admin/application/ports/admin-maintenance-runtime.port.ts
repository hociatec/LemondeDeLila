export type MaintenanceCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type MaintenanceSystemctlShow = Record<string, string>;

export type MaintenanceOperation =
  | Readonly<{ kind: 'build'; cwd: string; timeoutMs: number }>
  | Readonly<{ kind: 'migrate'; cwd: string; timeoutMs: number }>
  | Readonly<{ kind: 'daemon-reload' }>
  | Readonly<{ kind: 'unit-status'; unit: string }>
  | Readonly<{ kind: 'unit-logs'; unit: string; tail: number }>;

export type ScheduledMaintenanceOperation =
  | Readonly<{ kind: 'start-unit'; unit: string }>
  | Readonly<{ kind: 'restart-unit'; unit: string; delayMs: number }>
  | Readonly<{
      kind: 'build-and-restart';
      cwd: string;
      unit: string;
      delayMs: number;
    }>;

export interface AdminMaintenanceRuntimePort {
  execute(operation: MaintenanceOperation): MaintenanceCommandResult;

  schedule(operation: ScheduledMaintenanceOperation): void;

  probeLoopback(
    port: number,
    timeoutMs: number,
  ): Promise<{ statusCode: number; body: string }>;

  parseSystemctlShow(raw: string): MaintenanceSystemctlShow;

  parseTail(rawTail?: string): number;
}

export const ADMIN_MAINTENANCE_RUNTIME_PORT = Symbol(
  'ADMIN_MAINTENANCE_RUNTIME_PORT',
);
