import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';

type SocialProfileSettingsJson = {
  bioMinLength?: unknown;
  bioMaxLength?: unknown;
};

type RoomMaintenanceSettingsJson = {
  autoCleanupEnabled?: unknown;
  autoCleanupIntervalSeconds?: unknown;
  autoCleanupOlderThanMinutes?: unknown;
  autoCleanupLimit?: unknown;
};

function safeParseJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeProfile(input: Partial<SocialProfileSettingsJson>): {
  bioMinLength: number;
  bioMaxLength: number;
} {
  const min = Number.isFinite(input.bioMinLength as number)
    ? Math.max(0, Math.floor(input.bioMinLength as number))
    : 0;
  const max = Number.isFinite(input.bioMaxLength as number)
    ? Math.max(0, Math.min(5000, Math.floor(input.bioMaxLength as number)))
    : 500;
  const clampedMin = Math.min(min, max);
  return { bioMinLength: clampedMin, bioMaxLength: max };
}

function normalizeRoom(input: Partial<RoomMaintenanceSettingsJson>): {
  autoCleanupEnabled: boolean;
  autoCleanupIntervalSeconds: number;
  autoCleanupOlderThanMinutes: number;
  autoCleanupLimit: number;
} {
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

export class ImportLegacySettingsJson1735900000000
  implements MigrationInterface
{
  name = 'ImportLegacySettingsJson1735900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dataDir = path.join(process.cwd(), 'data');
    const profilePath = path.join(dataDir, 'social-profile-settings.json');
    const roomPath = path.join(dataDir, 'room-maintenance.json');

    if (await queryRunner.hasTable('social_profile_settings')) {
      const legacy = safeParseJsonFile<SocialProfileSettingsJson>(profilePath);
      if (legacy) {
        const normalized = normalizeProfile(legacy);
        const rows = (await queryRunner.query(
          'SELECT bio_min_length as bioMinLength, bio_max_length as bioMaxLength FROM social_profile_settings WHERE id = 1 LIMIT 1',
        )) as Array<{ bioMinLength: number; bioMaxLength: number }>;

        if (rows.length === 0) {
          await queryRunner.query(
            'INSERT INTO social_profile_settings (id, bio_min_length, bio_max_length) VALUES (1, ?, ?)',
            [normalized.bioMinLength, normalized.bioMaxLength],
          );
        } else {
          const current = rows[0];
          const isDefault = current.bioMinLength === 0 && current.bioMaxLength === 500;
          if (isDefault) {
            await queryRunner.query(
              'UPDATE social_profile_settings SET bio_min_length = ?, bio_max_length = ? WHERE id = 1',
              [normalized.bioMinLength, normalized.bioMaxLength],
            );
          }
        }
      }
    }

    if (await queryRunner.hasTable('room_maintenance_settings')) {
      const legacy = safeParseJsonFile<RoomMaintenanceSettingsJson>(roomPath);
      if (legacy) {
        const normalized = normalizeRoom(legacy);
        const rows = (await queryRunner.query(
          `SELECT
            auto_cleanup_enabled as autoCleanupEnabled,
            auto_cleanup_older_than_minutes as autoCleanupOlderThanMinutes,
            auto_cleanup_interval_seconds as autoCleanupIntervalSeconds,
            auto_cleanup_limit as autoCleanupLimit
           FROM room_maintenance_settings
           WHERE id = 1
           LIMIT 1`,
        )) as Array<{
          autoCleanupEnabled: number | boolean;
          autoCleanupOlderThanMinutes: number;
          autoCleanupIntervalSeconds: number;
          autoCleanupLimit: number;
        }>;

        if (rows.length === 0) {
          await queryRunner.query(
            `INSERT INTO room_maintenance_settings
              (id, auto_cleanup_enabled, auto_cleanup_older_than_minutes, auto_cleanup_interval_seconds, auto_cleanup_limit)
             VALUES (1, ?, ?, ?, ?)`,
            [
              normalized.autoCleanupEnabled,
              normalized.autoCleanupOlderThanMinutes,
              normalized.autoCleanupIntervalSeconds,
              normalized.autoCleanupLimit,
            ],
          );
        } else {
          const current = rows[0];
          const currentEnabled =
            current.autoCleanupEnabled === true || current.autoCleanupEnabled === 1;
          const isDefault =
            currentEnabled === false &&
            current.autoCleanupOlderThanMinutes === 60 &&
            current.autoCleanupIntervalSeconds === 300 &&
            current.autoCleanupLimit === 1000;

          if (isDefault) {
            await queryRunner.query(
              `UPDATE room_maintenance_settings
               SET
                 auto_cleanup_enabled = ?,
                 auto_cleanup_older_than_minutes = ?,
                 auto_cleanup_interval_seconds = ?,
                 auto_cleanup_limit = ?
               WHERE id = 1`,
              [
                normalized.autoCleanupEnabled,
                normalized.autoCleanupOlderThanMinutes,
                normalized.autoCleanupIntervalSeconds,
                normalized.autoCleanupLimit,
              ],
            );
          }
        }
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: importing legacy JSON is non-reversible.
  }
}
