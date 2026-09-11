import { Global, Module } from '@nestjs/common';
import { CatalogService } from '../../modules/catalog/public-api';
import { CatalogModule } from '../../modules/catalog/composition-api';
import { PresenceService } from '../../modules/presence/public-api';
import { PresenceModule } from '../../modules/presence/composition-api';
import { GameStatsService } from '../../modules/stats/public-api';
import { StatsModule } from '../../modules/stats/composition-api';
import {
  ROOM_CATALOG_PORT,
  ROOM_PRESENCE_PORT,
  ROOM_STATS_PORT,
} from '../../modules/room/public-api';
import { RoomModule } from '../../modules/room/composition-api';

/** Composition-root bindings for room workflows crossing bounded contexts. */
@Global()
@Module({
  imports: [RoomModule, CatalogModule, PresenceModule, StatsModule],
  providers: [
    { provide: ROOM_CATALOG_PORT, useExisting: CatalogService },
    { provide: ROOM_PRESENCE_PORT, useExisting: PresenceService },
    { provide: ROOM_STATS_PORT, useExisting: GameStatsService },
  ],
  exports: [ROOM_CATALOG_PORT, ROOM_PRESENCE_PORT, ROOM_STATS_PORT],
})
export class AppRoomWorkflowPortsModule {}
