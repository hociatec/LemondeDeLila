export interface AdminNotificationPort {
  notifyUser(
    userId: number,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;

  disconnectAll(reason?: string): void;
}

export const ADMIN_NOTIFICATION_PORT = Symbol('ADMIN_NOTIFICATION_PORT');
