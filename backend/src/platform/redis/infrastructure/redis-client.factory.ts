import { Injectable, Logger } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisClientFactory {
  private readonly logger = new Logger(RedisClientFactory.name);

  create(url: string, name: string, options?: RedisOptions): Redis {
    const client = new Redis(url, {
      connectTimeout: 10_000,
      commandTimeout: 10_000,
      maxRetriesPerRequest: 1,
      ...(options ?? {}),
      // An unacknowledged write may already have executed on Redis.
      autoResendUnfulfilledCommands: false,
    });
    client.on('error', (err: Error) => {
      this.logger.error(`[${name}] redis error`, err.stack ?? String(err));
    });
    return client;
  }
}
