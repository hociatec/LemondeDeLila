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
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

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
            const state = await this.engine.exportInternalState(
              key.roomId,
              key.gameType,
            );
            if (!state) continue;
            if (
              !(await this.rooms.isCurrent(
                key.roomId,
                key.gameType,
                state.metadata?.roomRunId ?? null,
              ))
            ) {
              // Version + restore identity prevent a delayed scan deleting a new session.
              await this.engine.clearInternalStateIf(
                key.roomId,
                key.gameType,
                state,
              );
              continue;
            }
            const handler = this.registry.getHandler(key.gameType);
            if (!handler)
              throw new Error(`Unknown game runtime: ${key.gameType}`);
            this.automation.schedule({ ...key, handler, state });
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
