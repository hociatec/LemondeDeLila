import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type RoomMaintenanceSettings = {
  autoCleanupEnabled: boolean;
  autoCleanupOlderThanMinutes: number;
  autoCleanupIntervalSeconds: number;
  autoCleanupLimit: number;
};

type StoredRoomMaintenanceSettings = Partial<RoomMaintenanceSettings>;

@Injectable()
export class RoomMaintenanceSettingsService {
  private readonly settingsPath: string;

  constructor() {
    this.settingsPath = path.resolve(process.cwd(), 'data', 'room-maintenance.json');
  }

  private defaults(): RoomMaintenanceSettings {
    const enabledRaw = (process.env.ROOM_AUTO_CLEANUP_ENABLED || '').trim().toLowerCase();
    const enabled =
      enabledRaw === '1' ||
      enabledRaw === 'true' ||
      enabledRaw === 'yes' ||
      enabledRaw === 'y';

    const intervalSeconds = Number.parseInt(
      (process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS || '300').trim(),
      10,
    );
    const olderThanMinutes = Number.parseInt(
      (process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES || '60').trim(),
      10,
    );
    const limit = Number.parseInt(
      (process.env.ROOM_AUTO_CLEANUP_LIMIT || '1000').trim(),
      10,
    );

    return this.normalize({
      autoCleanupEnabled: enabled,
      autoCleanupIntervalSeconds: intervalSeconds,
      autoCleanupOlderThanMinutes: olderThanMinutes,
      autoCleanupLimit: limit,
    });
  }

  private normalize(input: Partial<RoomMaintenanceSettings>): RoomMaintenanceSettings {
    const enabled = input.autoCleanupEnabled === true;
    const interval = Number.isFinite(input.autoCleanupIntervalSeconds as number)
      ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds as number))
      : 300;
    const older = Number.isFinite(input.autoCleanupOlderThanMinutes as number)
      ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes as number))
      : 60;
    const limit = Number.isFinite(input.autoCleanupLimit as number)
      ? Math.max(1, Math.min(5000, Math.floor(input.autoCleanupLimit as number)))
      : 1000;

    return {
      autoCleanupEnabled: enabled,
      autoCleanupIntervalSeconds: interval,
      autoCleanupOlderThanMinutes: older,
      autoCleanupLimit: limit,
    };
  }

  get(): RoomMaintenanceSettings {
    const base = this.defaults();
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return base;
      }
      const raw = fs.readFileSync(this.settingsPath, 'utf-8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw) as StoredRoomMaintenanceSettings;
      return this.normalize({ ...base, ...parsed });
    } catch {
      return base;
    }
  }

  update(patch: Partial<RoomMaintenanceSettings>): RoomMaintenanceSettings {
    const current = this.get();
    const next = this.normalize({ ...current, ...patch });
    try {
      fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify(next, null, 2), 'utf-8');
    } catch {
      // best effort: still return computed settings
    }
    return next;
  }
}
