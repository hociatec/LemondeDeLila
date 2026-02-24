import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomMaintenanceSettingsService } from './room-maintenance-settings.service';
export declare class RoomAutoCleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly rooms;
    private readonly settings;
    private readonly logger;
    private timer;
    private lastRunAtMs;
    constructor(rooms: RoomService, settings: RoomMaintenanceSettingsService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    private tick;
}
