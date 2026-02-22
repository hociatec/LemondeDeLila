import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RoomMaintenanceSettingsEntity } from '../entities/room-maintenance-settings.entity';
export type RoomMaintenanceSettings = {
    autoCleanupEnabled: boolean;
    autoCleanupOlderThanMinutes: number;
    autoCleanupIntervalSeconds: number;
    autoCleanupLimit: number;
};
export declare class RoomMaintenanceSettingsService implements OnModuleInit {
    private readonly repo;
    private cache;
    constructor(repo: Repository<RoomMaintenanceSettingsEntity>);
    onModuleInit(): Promise<void>;
    private defaults;
    private normalize;
    get(): RoomMaintenanceSettings;
    update(patch: Partial<RoomMaintenanceSettings>): Promise<RoomMaintenanceSettings>;
    private ensureSeeded;
}
