import { Module } from '@nestjs/common';
import { ROOM_ADMIN_PORT } from '../application/ports/room-admin.port';
import { ROOM_GAME_PORT } from '../application/ports/room-game.port';
import { ROOM_VAULT_PORT } from '../application/ports/room-vault.port';
import { ROOM_EVENTS_PORT } from '../application/ports/room-events.port';
import { RoomMaintenanceSettingsService } from '../application/services/room-maintenance-settings.service';
import { ROOM_MODULE_IMPORTS } from './room.module.imports';
import { ROOM_CORE_PROVIDERS } from './room.module.providers.core';
import { ROOM_PRESENTATION_PROVIDERS } from './room.module.providers.presentation';

@Module({
  imports: ROOM_MODULE_IMPORTS,
  providers: [...ROOM_CORE_PROVIDERS, ...ROOM_PRESENTATION_PROVIDERS],
  exports: [
    RoomMaintenanceSettingsService,
    ROOM_ADMIN_PORT,
    ROOM_GAME_PORT,
    ROOM_VAULT_PORT,
    ROOM_EVENTS_PORT,
  ],
})
export class RoomModule {}
