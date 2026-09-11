import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisRateLimitStorage } from '../../../redis/public-api';
import {
  WS_RUNTIME_CONFIG,
  type WsRuntimeConfig,
} from '../ports/ws-runtime-config.port';

/** One user budget across endpoints, sockets and backend instances. */
@Injectable()
export class WsRequestRateLimitService {
  private readonly logger = new Logger(WsRequestRateLimitService.name);

  constructor(
    private readonly storage: RedisRateLimitStorage,
    @Inject(WS_RUNTIME_CONFIG)
    private readonly config: Pick<
      WsRuntimeConfig,
      'wsRateLimitWindowMs' | 'wsRateLimitCount'
    >,
  ) {}

  async allow(
    userId: number | null | undefined,
    peerAddress = 'unknown',
  ): Promise<boolean> {
    const actor =
      userId != null && Number.isSafeInteger(userId) && userId > 0
        ? `user:${userId}`
        : `peer:${peerAddress}`;
    const key = createHash('sha256').update(actor).digest('hex');
    const windowMs = this.config.wsRateLimitWindowMs;
    const limit = this.config.wsRateLimitCount;
    try {
      const result = await this.storage.increment(
        key,
        windowMs,
        limit,
        windowMs,
        'ws',
      );
      return !result.isBlocked && result.totalHits <= limit;
    } catch {
      this.logger.warn('Quota WebSocket indisponible : commande refusée');
      return false;
    }
  }
}
