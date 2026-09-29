import { randomInt } from 'node:crypto';
import { operationalSettings } from '../../../../../platform/config/public-api';
import { WebSocket } from 'ws';

export function notificationReconnectDelay(): number {
  const configured = operationalSettings.wsReconnectBackoffMs;
  const base = Number.isFinite(configured)
    ? Math.max(100, Math.min(30_000, Math.trunc(configured)))
    : 1_000;
  return base + randomInt(0, Math.floor(base / 2) + 1);
}

/** Backoff owned by the socket: closing it (including shutdown) cancels the timer. */
export function waitForNotificationReconnect(
  client: WebSocket,
  delayMs = notificationReconnectDelay(),
): Promise<void> {
  if (client.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.off('close', finish);
      resolve();
    };
    const timeout = setTimeout(finish, delayMs);
    timeout.unref();
    client.once('close', finish);
  });
}
