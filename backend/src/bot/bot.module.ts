import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomBot } from '../room/entities/room-bot.entity';
import { Room } from '../room/entities/room.entity';
import { RoomParticipant } from '../room/entities/room-participant.entity';
import { User } from '../user/entities/user.entity';
import { BotName } from './entities/bot-name.entity';
import { BotService } from './services/bot.service';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoomBot, Room, RoomParticipant, User, BotName]),
    forwardRef(() => RoomModule),
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
