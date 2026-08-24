import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'room_maintenance_settings' })
export class RoomMaintenanceSettingsEntity {
  @PrimaryColumn({ type: 'tinyint' })
  id!: number;

  @Column({ name: 'auto_cleanup_enabled', type: 'boolean', default: false })
  autoCleanupEnabled!: boolean;

  @Column({ name: 'auto_cleanup_older_than_minutes', type: 'int', default: 60 })
  autoCleanupOlderThanMinutes!: number;

  @Column({ name: 'auto_cleanup_interval_seconds', type: 'int', default: 300 })
  autoCleanupIntervalSeconds!: number;

  @Column({ name: 'auto_cleanup_limit', type: 'int', default: 1000 })
  autoCleanupLimit!: number;
}
