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
import { PresenceModule } from '../presence/presence.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomInviteService } from './services/room-invite.service';
import { RoomDirectoryWsHandler } from './gateways/room-directory-ws.handler';
import { RoomWsRegistrar } from './gateways/room-ws.registrar';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomParticipant, RoomBot, User]),
    forwardRef(() => BotModule),
    forwardRef(() => PresenceModule),
    NotificationModule,
    CatalogModule,
  ],
  providers: [
    RoomService,
    RoomGateway,
    RoomInviteService,
    RoomDirectoryWsHandler,
    RoomWsRegistrar,
  ],
  exports: [RoomService],
})
export class RoomModule {}
