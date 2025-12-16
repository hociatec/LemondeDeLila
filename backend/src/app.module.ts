import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/entities/user.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { CatalogModule } from './catalog/catalog.module';
import { MessagingModule } from './messaging/messaging.module';
import { PrivateMessage } from './messaging/entities/private-message.entity';
import { PresenceModule } from './presence/presence.module';
import { Room } from './room/entities/room.entity';
import { RoomParticipant } from './room/entities/room-participant.entity';
import { RoomBot } from './room/entities/room-bot.entity';
import { RoomModule } from './room/room.module';
import { GameModule } from './game/game.module';
import { BotModule } from './bot/bot.module';
import { BotName } from './bot/entities/bot-name.entity';
import { AdminModule } from './admin/admin.module';
import { WsRoutingModule } from './common/ws/ws-routing.module';
import { ValidationModule } from './common/validation/validation.module';
import { GameWsModule } from './game/ws/game-ws.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const dbConfig = url
          ? { url }
          : {
              type: 'mysql' as const,
              host: config.get<string>('DB_HOST', '127.0.0.1'),
              port: parseInt(config.get<string>('DB_PORT', '3306'), 10),
              username: config.get<string>('DB_USER', 'root'),
              password: config.get<string>('DB_PASSWORD', ''),
              database: config.get<string>('DB_NAME', 'le_monde_de_lila'),
            };
        return {
          type: 'mysql' as const,
          entities: [User, ChatMessage, PrivateMessage, Room, RoomParticipant, RoomBot, BotName],
          synchronize: false,
          logging: false,
          ...dbConfig,
        };
      },
    }),
    UserModule,
    ChatModule,
    CatalogModule,
    MessagingModule,
    PresenceModule,
    RoomModule,
    GameModule,
    GameWsModule,
    BotModule,
    WsRoutingModule,
    ValidationModule,
    RealtimeModule,
    NotificationModule,
    AdminModule,
  ],
})
export class AppModule {}
