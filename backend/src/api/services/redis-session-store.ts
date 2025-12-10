import { Logger } from '@nestjs/common';
import { SessionState, SessionStateStore } from './session-store.interface';

type RedisLikeClient = {
  connect: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: any) => Promise<any>;
  del: (key: string) => Promise<any>;
  quit: () => Promise<any>;
  on?: (event: string, listener: (err: any) => void) => void;
};

/**
 * Stockage des sessions dans Redis.
 * Connexion paresseuse pour éviter d'échouer si Redis n'est pas configuré.
 */
export class RedisSessionStore implements SessionStateStore {
  private client: RedisLikeClient | null = null;
  private readonly logger = new Logger(RedisSessionStore.name);

  constructor(
    private readonly url: string,
    private readonly ttlSeconds = 86_400, // 24h
    private readonly prefix = 'ws:sessions:',
  ) {}

  private async ensureClient(): Promise<RedisLikeClient> {
    if (this.client) return this.client;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const redis = require('redis');
    const client: RedisLikeClient = redis.createClient({ url: this.url });
    client.on?.('error', (err: any) => this.logger.error('Redis session store error', err));
    await client.connect();
    this.client = client;
    return client;
  }

  async save(connectionId: string, state: SessionState): Promise<void> {
    const client = await this.ensureClient();
    const key = this.prefix + connectionId;
    await client.set(key, JSON.stringify(state), this.ttlSeconds ? { EX: this.ttlSeconds } : undefined);
  }

  async get(connectionId: string): Promise<SessionState | null> {
    const client = await this.ensureClient();
    const raw = await client.get(this.prefix + connectionId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionState;
    } catch {
      return null;
    }
  }

  async delete(connectionId: string): Promise<void> {
    const client = await this.ensureClient();
    await client.del(this.prefix + connectionId);
  }
}
