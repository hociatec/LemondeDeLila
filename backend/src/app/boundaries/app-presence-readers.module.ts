import { Global, Module } from '@nestjs/common';
import { ACTIVE_ROOM_PARTICIPANTS_READER } from '../../modules/room/public-api';
import { RoomModule } from '../../modules/room/composition-api';
import { PRESENCE_ROOM_PARTICIPANT_REPOSITORY } from '../../modules/presence/composition-api';

@Global()
@Module({
  imports: [RoomModule],
  providers: [
    {
      provide: PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
      useExisting: ACTIVE_ROOM_PARTICIPANTS_READER,
    },
  ],
  exports: [PRESENCE_ROOM_PARTICIPANT_REPOSITORY],
})
export class AppPresenceReadersModule {}
