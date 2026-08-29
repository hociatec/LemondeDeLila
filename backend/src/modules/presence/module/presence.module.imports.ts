import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../../chat/public-api';
import { UpdateModule } from '../../update/public-api';
import { RoomParticipant } from '../../room/infrastructure/persistence/typeorm/entities/room-participant.entity';
import { User } from '../../user/public-api';

export const PRESENCE_MODULE_IMPORTS = [
  ConfigModule,
  ChatModule,
  UpdateModule,
  TypeOrmModule.forFeature([RoomParticipant, User]),
];
