import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import {
  GAME_SESSION_RECOVERY_READER,
  type GameSessionKey,
  type GameSessionRecoveryReader,
} from '../../application/ports/game-session-recovery.reader';
import { GameEngineService } from '../../application/services/game-engine.service';
import { GameRegistryService } from '../../application/services/game-registry.service';
import { GameRealtimeAutomationService } from '../../application/services/game-realtime-automation.service';

const RECOVERY_INTERVAL_MS = 5_000;
const RECOVERY_PAGE_SIZE = 100;

/** SQL commits are the durable intent. Redis delivery can always be reconstructed. */
@Injectable()
export class GameAutomationRecoveryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GameAutomationRecoveryService.name);
  private cursor: GameSessionKey | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(GAME_SESSION_RECOVERY_READER)
    private readonly sessions: GameSessionRecoveryReader,
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
    private readonly automation: GameRealtimeAutomationService,
    private readonly shutdown: ApplicationShutdownService,
  ) {}

  onApplicationBootstrap(): void {
    this.shutdown.registerSource('game-automation-recovery', () =>
      this.onModuleDestroy(),
    );
    this.timer = setInterval(() => void this.recover(), RECOVERY_INTERVAL_MS);
    this.timer.unref();
    void this.recover();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async recover(): Promise<void> {
    if (this.running || this.shutdown.isDraining) return;
    this.running = true;
    try {
      await this.shutdown.run(async () => {
        const sessions = await this.sessions.listAfter(
          this.cursor,
          RECOVERY_PAGE_SIZE,
        );
        for (const key of sessions) {
          try {
            const handler = this.registry.getHandler(key.gameType);
            if (!handler)
              throw new Error(`Unknown game runtime: ${key.gameType}`);
            const state = await this.engine.exportInternalState(
              key.roomId,
              key.gameType,
            );
            if (state) this.automation.schedule({ ...key, handler, state });
          } catch (error) {
            this.report(error, key);
          }
        }
        // Failed rows are retried on the next sweep; one row cannot starve others.
        this.cursor =
          sessions.length === RECOVERY_PAGE_SIZE
            ? (sessions.at(-1) ?? null)
            : null;
      });
    } catch (error) {
      this.report(error);
    } finally {
      this.running = false;
    }
  }

  private report(error: unknown, key?: GameSessionKey): void {
    this.logger.error(
      JSON.stringify({
        event: 'game.automation.recovery.failed',
        ...key,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
