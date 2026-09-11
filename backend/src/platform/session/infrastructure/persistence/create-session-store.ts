import type { SessionStateStore } from '../../application/ports/session-state-store.port';
import { RedisSessionStore } from './redis-session-store';

export function createSessionStore(redisUrl: string): SessionStateStore {
  return new RedisSessionStore(redisUrl);
}
