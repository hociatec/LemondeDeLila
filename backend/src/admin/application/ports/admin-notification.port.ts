export interface AdminNotificationPort {
  notifyUser(
    userId: number,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;

  notifyClientUpdateAvailable(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;

  notifyClientUpdateRequired(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;

  notifyClientUpdateImminent(
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void>;

  disconnectAll(reason?: string): void;
}

export const ADMIN_NOTIFICATION_PORT = Symbol('ADMIN_NOTIFICATION_PORT');
