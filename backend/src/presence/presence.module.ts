import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatModule } from '../chat/chat.module';
import { PresenceGateway } from './gateways/presence.gateway';
import { PresenceService } from './services/presence.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomParticipant } from '../room/entities/room-participant.entity';
import { Room } from '../room/entities/room.entity';
import { User } from '../user/entities/user.entity';
import {
  PresenceTransport,
  RedisPresenceTransport,
} from './services/presence-transport';
import { RedisClientFactory } from '../common/redis/redis-client.factory';

@Module({
  imports: [
    ConfigModule,
    ChatModule,
    TypeOrmModule.forFeature([RoomParticipant, Room, User]),
  ],
  providers: [
    {
      provide: PresenceTransport,
      inject: [ConfigService, RedisClientFactory],
      useFactory: async (config: ConfigService, redisFactory: RedisClientFactory) => {
        const redisUrl =
          config.get<string>('PRESENCE_REDIS_URL') ||
          config.get<string>('SESSION_STORE_REDIS_URL');
        if (!redisUrl) {
          throw new Error(
            'PRESENCE_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour la présence.',
          );
        }
        const transport = new RedisPresenceTransport(redisUrl, redisFactory);
        await transport.connect();
        return transport;
      },
    },
    PresenceGateway,
    PresenceService,
  ],
  exports: [PresenceService],
})
export class PresenceModule {}
