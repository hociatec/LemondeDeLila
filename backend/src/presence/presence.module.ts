import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { PresenceGateway } from './gateways/presence.gateway';
import { PresenceService } from './services/presence.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomParticipant } from '../room/entities/room-participant.entity';
import { Room } from '../room/entities/room.entity';

@Module({
  imports: [ChatModule, TypeOrmModule.forFeature([RoomParticipant, Room])],
  providers: [PresenceGateway, PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
