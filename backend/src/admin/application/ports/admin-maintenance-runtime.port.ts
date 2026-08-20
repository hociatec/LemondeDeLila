export type MaintenanceCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type MaintenanceSystemctlShow = Record<string, string>;

export interface AdminMaintenanceRuntimePort {
  runCommand(
    argv: string[],
    opts?: { cwd?: string; timeoutMs?: number },
  ): MaintenanceCommandResult;

  spawnDetached(
    argv: string[],
    opts?: { cwd?: string; delayMs?: number },
  ): void;

  httpGet(
    url: string,
    timeoutMs: number,
  ): Promise<{ statusCode: number; body: string }>;

  parseSystemctlShow(raw: string): MaintenanceSystemctlShow;

  parseTail(rawTail?: string): number;

  shQuote(value: string): string;
}

export const ADMIN_MAINTENANCE_RUNTIME_PORT = Symbol(
  'ADMIN_MAINTENANCE_RUNTIME_PORT',
);
