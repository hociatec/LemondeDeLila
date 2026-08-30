import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RoomAdminContextService } from '../maintenance/room-admin-context.service';
import { RoomAdminMaintenanceService } from '../maintenance/room-admin-maintenance.service';
import { RoomMaintenanceSettingsService } from '../maintenance/room-maintenance-settings.service';
import { bestEffort } from '../../../../../shared/utils/public-api';
import { operationalPolicy } from '../../../../../platform/config/public-api';

@Injectable()
export class RoomAutoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomAutoCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunAtMs = 0;

  constructor(
    private readonly roomAdminContext: RoomAdminContextService,
    private readonly adminMaintenance: RoomAdminMaintenanceService,
    private readonly settings: RoomMaintenanceSettingsService,
  ) {}

  onModuleInit() {
    // Timer is always running (cheap). Actual execution is gated by settings.
    this.timer = setInterval(() => {
      void bestEffort(
        this.tick(),
        'nettoyage automatique des rooms',
        this.logger,
      );
    }, operationalPolicy.roomCleanupTickMs);
    setTimeout(() => {
      void bestEffort(
        this.tick(),
        'nettoyage automatique initial des rooms',
        this.logger,
      );
    }, operationalPolicy.roomCleanupInitialDelayMs);
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    const s = this.settings.get();
    if (!s.autoCleanupEnabled) {
      return;
    }
    const now = Date.now();
    if (
      this.lastRunAtMs &&
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
