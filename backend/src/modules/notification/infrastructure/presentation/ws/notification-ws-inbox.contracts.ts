import type { WebSocket } from 'ws';
import type { NotificationClientMeta } from './notification-ws.types';

export type NotificationInboxResponseSender = (
  client: WebSocket,
  type: string,
  payload: unknown,
  requestId: string | null,
) => void;

export type NotificationInboxActor = {
  id: number;
  username: string;
  roles: string[];
};

export function notificationInboxActor(
  meta: NotificationClientMeta,
): NotificationInboxActor {
  return { id: meta.userId, username: meta.username, roles: meta.roles };
}

export function inboxString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
