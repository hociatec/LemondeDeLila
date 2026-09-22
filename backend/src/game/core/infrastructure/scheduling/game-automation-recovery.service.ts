import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  RedisDistributedLeaseService,
  type RedisDistributedLease,
} from '../../../../platform/redis/public-api';
import {
  prometheusMetrics,
  sanitizeLogText,
} from '../../../../platform/observability/public-api';
import { GameRecoveryBackoff } from './game-recovery-backoff';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import {
  GAME_SESSION_RECOVERY_READER,
  type GameSessionKey,
  type GameSessionRecoveryReader,
} from '../../application/ports/game-session-recovery.reader';
import { GameEngineService } from '../../application/services/game-engine.service';
import { GameRegistryService } from '../../application/services/game-registry.service';
import { GameRealtimeAutomationService } from '../../application/services/game-realtime-automation.service';
import {
  GAME_ROOM_RUN_READER,
  type GameRoomRunReader,
} from '../../application/ports/game-room-run-reader.port';

const RECOVERY_INTERVAL_MS = 5_000;
const RECOVERY_PAGE_SIZE = 100;

/** SQL commits are the durable intent. Redis delivery can always be reconstructed. */
@Injectable()
export class GameAutomationRecoveryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GameAutomationRecoveryService.name);
  private cursor: GameSessionKey | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private stopped = false;
  private readonly backoff = new GameRecoveryBackoff();

  constructor(
    @Inject(GAME_SESSION_RECOVERY_READER)
    private readonly sessions: GameSessionRecoveryReader,
    @Inject(GameEngineService)
    private readonly engine: Pick<
      GameEngineService,
      'exportInternalState' | 'clearInternalStateIf'
    >,
    @Inject(GameRegistryService)
    private readonly registry: Pick<GameRegistryService, 'getHandler'>,
    @Inject(GameRealtimeAutomationService)
    private readonly automation: Pick<
      GameRealtimeAutomationService,
      'schedule'
    >,
    private readonly shutdown: ApplicationShutdownService,
    @Inject(GAME_ROOM_RUN_READER) private readonly rooms: GameRoomRunReader,
    @Inject(RedisDistributedLeaseService)
    private readonly leases: Pick<RedisDistributedLeaseService, 'acquire'>,
  ) {}

  onApplicationBootstrap(): void {
    this.shutdown.registerSource('game-automation-recovery', () =>
      this.onModuleDestroy(),
    );
    this.scheduleNext(randomInt(1, 1_001));
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  async recover(): Promise<void> {
    if (this.running || this.stopped || this.shutdown.isDraining) return;
    this.running = true;
    const startedAt = performance.now();
    try {
      await this.shutdown.run(async () => {
        const lease = await this.leases.acquire(
          'lemonde:game:automation-recovery',
          30_000,
        );
        if (!lease) return;
        try {
          // Drain consecutive pages without imposing five seconds per page, but
          // bound each pass so recovery cannot monopolize SQL or the event loop.
          for (let page = 0; page < 10; page++) {
            if (
              this.stopped ||
              this.shutdown.isDraining ||
              !(await lease.isHeld())
            )
              return;
            const sessions = await this.sessions.listAfter(
              this.cursor,
              RECOVERY_PAGE_SIZE,
            );
            for (const key of sessions) {
              if (
                this.stopped ||
                this.shutdown.isDraining ||
                !(await lease.isHeld())
              )
                return;
              if (!(await this.recoverSession(key, lease))) return;
              this.cursor = key;
              // A slow row must not turn a page of 100 into an unbounded pass.
              // Keep the last completed key so the next pass resumes mid-page.
              if (performance.now() - startedAt >= 1_000) return;
            }
            // Failed rows retain their SQL state and are retried after backoff.
            this.cursor =
              sessions.length === RECOVERY_PAGE_SIZE
                ? (sessions.at(-1) ?? null)
                : null;
            if (!this.cursor) {
              this.backoff.completeSweep();
              prometheusMetrics.recovery.sweep();
              break;
            }
            if (performance.now() - startedAt >= 1_000) break;
          }
        } finally {
          await lease.release();
        }
      });
    } catch (error) {
      this.report(error);
    } finally {
      this.running = false;
      prometheusMetrics.recovery.pass(
        (performance.now() - startedAt) / 1_000,
        this.backoff.size,
      );
    }
  }

  private async recoverSession(
    key: GameSessionKey,
    lease: RedisDistributedLease,
  ): Promise<boolean> {
    if (!this.backoff.shouldRetry(key)) {
      prometheusMetrics.recovery.session('deferred');
      this.cursor = key;
      return true;
    }
    try {
      const state = await this.engine.exportInternalState(
        key.roomId,
        key.gameType,
      );
      if (!state) {
        this.backoff.recovered(key);
        prometheusMetrics.recovery.session('missing');
        return true;
      }
      if (
        !(await this.rooms.isCurrent(
          key.roomId,
          key.gameType,
          state.metadata?.roomRunId ?? null,
        ))
      ) {
        if (this.stopped || this.shutdown.isDraining || !(await lease.isHeld()))
          return false;
        // Version + restore identity prevent a delayed scan deleting a new session.
        await this.engine.clearInternalStateIf(key.roomId, key.gameType, state);
        this.backoff.recovered(key);
        prometheusMetrics.recovery.session('obsolete');
        return true;
      }
      const handler = this.registry.getHandler(key.gameType);
      if (!handler) throw new Error(`Unknown game runtime: ${key.gameType}`);
      if (this.stopped || this.shutdown.isDraining || !(await lease.isHeld()))
        return false;
      this.automation.schedule({ ...key, handler, state });
      this.backoff.recovered(key);
      prometheusMetrics.recovery.session('scheduled');
    } catch (error) {
      const retryAfterMs = this.backoff.failed(key);
      prometheusMetrics.recovery.session('failed');
      this.report(error, key, retryAfterMs);
    }
    return true;
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped || this.shutdown.isDraining) return;
    this.timer = setTimeout(() => {
      void this.recover().finally(() =>
        this.scheduleNext(
          (this.cursor ? 250 : RECOVERY_INTERVAL_MS) + randomInt(0, 1_001),
        ),
      );
    }, delayMs);
    this.timer.unref();
  }

  private report(
    error: unknown,
    key?: GameSessionKey,
    retryAfterMs?: number,
  ): void {
    this.logger.error(
      JSON.stringify({
        event: 'game.automation.recovery.failed',
        ...key,
        retryAfterMs,
        message: sanitizeLogText(error),
      }),
    );
  }
}
