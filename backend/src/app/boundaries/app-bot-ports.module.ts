import { Global, Module } from '@nestjs/common';
import { ROOM_BOTS_REPOSITORY } from '../../modules/room/composition-api';
import { RoomModule } from '../../modules/room/composition-api';
import { CountRoomBotsService } from '../../modules/bot/public-api';
import { BOT_ROOM_REPOSITORY } from '../../modules/bot/composition-api';
import { BotModule } from '../../modules/bot/composition-api';
import {
  ROOM_BOT_COUNTER_PORT,
  ROOM_BOT_OPERATIONS_PORT,
} from '../../modules/room/public-api';
import { AppRoomBotOperationsAdapter } from './app-room-bot-operations.adapter';

@Global()
@Module({
  imports: [RoomModule, BotModule],
  providers: [
    { provide: BOT_ROOM_REPOSITORY, useExisting: ROOM_BOTS_REPOSITORY },
    {
      provide: ROOM_BOT_COUNTER_PORT,
      useExisting: CountRoomBotsService,
    },
    AppRoomBotOperationsAdapter,
    {
      provide: ROOM_BOT_OPERATIONS_PORT,
      useExisting: AppRoomBotOperationsAdapter,
    },
  ],
  exports: [
    BOT_ROOM_REPOSITORY,
    ROOM_BOT_COUNTER_PORT,
    ROOM_BOT_OPERATIONS_PORT,
  ],
})
export class AppBotPortsModule {}
