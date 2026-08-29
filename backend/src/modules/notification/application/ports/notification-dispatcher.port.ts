export const NOTIFICATION_DISPATCHER = Symbol('NOTIFICATION_DISPATCHER');

export type NotificationDispatcher = {
  notifyUser(
    userId: number,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
  notifyAll(eventType: string, payload: Record<string, unknown>): Promise<void>;
  disconnectAll(reason?: string, eventType?: string): void;
};
