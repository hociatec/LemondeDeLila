import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomMaintenanceSettingsService } from './room-maintenance-settings.service';

@Injectable()
export class RoomAutoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomAutoCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunAtMs = 0;

  constructor(
    private readonly rooms: RoomService,
    private readonly settings: RoomMaintenanceSettingsService,
  ) {}

  onModuleInit() {
    // Timer is always running (cheap). Actual execution is gated by settings.
    this.timer = setInterval(() => this.tick().catch(() => {}), 30_000);
    setTimeout(() => {
      this.tick().catch(() => {});
    }, 5_000);
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

    const res = await this.rooms.adminCleanupRooms({
      includePrivate: false,
      includeStarted: false,
      olderThanMinutes: s.autoCleanupOlderThanMinutes,
      limit: s.autoCleanupLimit,
      dryRun: false,
      excludeActivePlayers: true,
    });
    if (res.deleted > 0) {
      this.logger.warn(
        `Auto cleanup removed rooms: deleted=${res.deleted} matched=${res.matched} olderThanMinutes=${s.autoCleanupOlderThanMinutes}`,
      );
    }
  }
}
