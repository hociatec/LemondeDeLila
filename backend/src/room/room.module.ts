import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomParticipant } from './entities/room-participant.entity';
import { RoomBot } from './entities/room-bot.entity';
import { RoomService } from './services/room.service';
import { RoomGateway } from './gateways/room.gateway';
import { User } from '../user/entities/user.entity';
import { forwardRef } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomInviteService } from './services/room-invite.service';
import { RoomDirectoryWsHandler } from './ws/room-directory-ws.handler';
import { RoomWsRegistrar } from './ws/room-ws.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomParticipant, RoomBot, User]),
    forwardRef(() => BotModule),
    NotificationModule,
  ],
  providers: [RoomService, RoomGateway, RoomInviteService, RoomDirectoryWsHandler, RoomWsRegistrar],
  exports: [RoomService],
})
export class RoomModule {}
