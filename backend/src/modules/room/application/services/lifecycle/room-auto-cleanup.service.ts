import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RoomAdminContextService } from '../maintenance/room-admin-context.service';
import { RoomAdminMaintenanceService } from '../maintenance/room-admin-maintenance.service';
import { RoomMaintenanceSettingsService } from '../maintenance/room-maintenance-settings.service';
import { bestEffort } from '../../../../../platform/observability/public-api';
import { operationalSettings } from '../../../../../platform/config/public-api';
import { ApplicationShutdownService } from '../../../../../platform/lifecycle/public-api';

@Injectable()
export class RoomAutoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomAutoCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;
  private lastRunAtMs: number | null = null;

  constructor(
    private readonly roomAdminContext: RoomAdminContextService,
    private readonly adminMaintenance: RoomAdminMaintenanceService,
    private readonly settings: RoomMaintenanceSettingsService,
    @Inject(ApplicationShutdownService)
    private readonly shutdown = new ApplicationShutdownService(),
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {
    shutdown.registerSource('room-auto-cleanup', () => this.onModuleDestroy());
  }

  onModuleInit() {
    // Timer is always running (cheap). Actual execution is gated by settings.
    this.timer = setInterval(() => {
      void bestEffort(
        this.shutdown.run(() => this.tick()),
        'nettoyage automatique des rooms',
        this.logger,
      );
    }, operationalSettings.roomCleanupTickMs);
    this.initialTimer = setTimeout(() => {
      this.initialTimer = null;
      void bestEffort(
        this.shutdown.run(() => this.tick()),
        'nettoyage automatique initial des rooms',
        this.logger,
      );
    }, operationalSettings.roomCleanupInitialDelayMs);
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
  }

  private async tick() {
    const s = this.settings.get();
    if (!s.autoCleanupEnabled) {
      return;
    }
    const now = this.clock.now();
    if (
      this.lastRunAtMs != null &&
      now - this.lastRunAtMs < s.autoCleanupIntervalSeconds * 1000
    ) {
      return;
    }
    this.lastRunAtMs = now;

    const res = await this.adminMaintenance.adminCleanupRooms(
      this.roomAdminContext.createContext(),
      {
        includePrivate: false,
        includeStarted: true,
        olderThanMinutes: s.autoCleanupOlderThanMinutes,
        limit: s.autoCleanupLimit,
        dryRun: false,
        excludeActivePlayers: true,
      },
    );
    if (res.deleted > 0) {
      this.logger.warn(
        `Auto cleanup removed rooms: deleted=${res.deleted} matched=${res.matched} olderThanMinutes=${s.autoCleanupOlderThanMinutes}`,
      );
    }
  }
}
/** Room application capability boundary. */
