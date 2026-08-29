export interface AdminPerfPort {
  snapshot(options?: { windowSeconds?: number }): unknown;
}

export const ADMIN_PERF_PORT = Symbol('ADMIN_PERF_PORT');
