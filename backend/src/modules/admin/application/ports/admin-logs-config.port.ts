export interface AdminLogsConfigPort {
  getLogDir(): string;
}

export const ADMIN_LOGS_CONFIG_PORT = Symbol('ADMIN_LOGS_CONFIG_PORT');
