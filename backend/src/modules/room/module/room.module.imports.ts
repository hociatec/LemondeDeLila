import { BusinessClockModule } from '../../../platform/time/public-api';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from '../../bot/composition-api';
import { CatalogModule } from '../../catalog/composition-api';
import { UpdateModule } from '../../update/composition-api';
import { NotificationModule } from '../../notification/composition-api';
import { PresenceModule } from '../../presence/composition-api';
import { SoundsModule } from '../../sounds/composition-api';
import { StatsModule } from '../../stats/composition-api';
import { RoomBot } from '../infrastructure/persistence/typeorm/entities/room-bot.entity';
import { RoomMaintenanceSettingsEntity } from '../infrastructure/persistence/typeorm/entities/room-maintenance-settings.entity';
import { RoomParticipant } from '../infrastructure/persistence/typeorm/entities/room-participant.entity';
import { Room } from '../infrastructure/persistence/typeorm/entities/room.entity';

export const ROOM_MODULE_IMPORTS = [
  BusinessClockModule,
  TypeOrmModule.forFeature([
    Room,
    RoomParticipant,
    RoomBot,
    RoomMaintenanceSettingsEntity,
  ]),
  BotModule,
  PresenceModule,
  NotificationModule,
  UpdateModule,
  SoundsModule,
  CatalogModule,
  StatsModule,
];
