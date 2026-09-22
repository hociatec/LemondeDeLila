import { randomInt } from 'node:crypto';
import { operationalSettings } from '../../../../../platform/config/public-api';

export function notificationReconnectDelay(): number {
  const configured = operationalSettings.wsReconnectBackoffMs;
  const base = Number.isFinite(configured)
    ? Math.max(100, Math.min(30_000, Math.trunc(configured)))
    : 1_000;
  return base + randomInt(0, Math.floor(base / 2) + 1);
}
