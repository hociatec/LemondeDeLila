import { forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from '../../bot/public-api';
import { CatalogModule } from '../../catalog/public-api';
import { ClientUpdatesModule } from '../../client-updates/public-api';
import { NotificationModule } from '../../notification/public-api';
import { PresenceModule } from '../../presence/public-api';
import { SoundsModule } from '../../sounds/public-api';
import { StatsModule } from '../../stats/public-api';
import { User } from '../../user/public-api';
import { VaultRoomSnapshotEntity } from '../../vault/infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';
import { RoomBot } from '../infrastructure/persistence/typeorm/entities/room-bot.entity';
import { RoomMaintenanceSettingsEntity } from '../infrastructure/persistence/typeorm/entities/room-maintenance-settings.entity';
import { RoomParticipant } from '../infrastructure/persistence/typeorm/entities/room-participant.entity';
import { Room } from '../infrastructure/persistence/typeorm/entities/room.entity';

export const ROOM_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([
    Room,
    RoomParticipant,
    RoomBot,
    RoomMaintenanceSettingsEntity,
    VaultRoomSnapshotEntity,
    User,
  ]),
  forwardRef(() => BotModule),
  forwardRef(() => PresenceModule),
  NotificationModule,
  ClientUpdatesModule,
  SoundsModule,
  CatalogModule,
  StatsModule,
];
