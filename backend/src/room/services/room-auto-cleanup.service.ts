import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RoomService } from './room.service';

@Injectable()
export class RoomAutoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomAutoCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly rooms: RoomService) {}

  onModuleInit() {
    const enabledRaw = (process.env.ROOM_AUTO_CLEANUP_ENABLED || '')
      .trim()
      .toLowerCase();
    const enabled =
      enabledRaw === '1' ||
      enabledRaw === 'true' ||
      enabledRaw === 'yes' ||
      enabledRaw === 'y';
    if (!enabled) return;

    const intervalSecondsRaw = (process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS || '300').trim();
    const intervalSeconds = Number.parseInt(intervalSecondsRaw, 10);
    const intervalMs = Math.max(30, Number.isFinite(intervalSeconds) ? intervalSeconds : 300) * 1000;

    this.timer = setInterval(() => {
      this.tick().catch(() => {});
    }, intervalMs);

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
    const olderThanMinutesRaw = (process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES || '60').trim();
    const olderThanMinutes = Math.max(5, Number.parseInt(olderThanMinutesRaw, 10) || 60);
    const limitRaw = (process.env.ROOM_AUTO_CLEANUP_LIMIT || '1000').trim();
    const limit = Math.max(1, Math.min(5000, Number.parseInt(limitRaw, 10) || 1000));

    const res = await this.rooms.adminCleanupRooms({
      includePrivate: false,
      includeStarted: false,
      olderThanMinutes,
      limit,
      dryRun: false,
      excludeActivePlayers: true,
    });
    if (res.deleted > 0) {
      this.logger.warn(
        `Auto cleanup removed rooms: deleted=${res.deleted} matched=${res.matched} olderThanMinutes=${olderThanMinutes}`,
      );
    }
  }
}

