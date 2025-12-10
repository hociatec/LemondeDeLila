import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CatalogModule } from '../catalog/catalog.module';
import { MessagingModule } from '../messaging/messaging.module';
import { GameRegistryModule } from '../game/engine/game-registry.module';
import { BoardModule } from '../game/modules/board/board.module';
import { CardsModule } from '../game/modules/cards/cards.module';
import { MovementModule } from '../game/modules/movement/movement.module';
import { InventoryModule } from '../game/modules/inventory/inventory.module';
import { ExchangeModule } from '../game/modules/exchange/exchange.module';
import { TurnModule } from '../game/modules/turn/turn.module';
import { EffectsModule } from '../game/modules/effects/effects.module';
import { QuizModule } from '../game/modules/quiz/quiz.module';
import { VictoryModule } from '../game/modules/victory/victory.module';
import { EngineModule } from '../game/engine/engine.module';
import { RealtimeApiGateway } from './gateways/realtime-api.gateway';
import { AuthMessageHandler } from './handlers/auth-message.handler';
import { CatalogMessageHandler } from './handlers/catalog-message.handler';
import { MessagingMessageHandler } from './handlers/messaging-message.handler';
import { UserMessageHandler } from './handlers/user-message.handler';
import { GameMessageHandler } from './handlers/game-message.handler';
import { GameContentService } from './services/game-content.service';
import { PayloadValidationService } from './services/payload-validation.service';
import { InMemorySessionStore } from './services/in-memory-session-store';
import { SESSION_STORE } from './services/session-store.interface';
import { RedisSessionStore } from './services/redis-session-store';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UserModule,
    CatalogModule,
    MessagingModule,
    GameRegistryModule,
    BoardModule,
    CardsModule,
    MovementModule,
    InventoryModule,
    ExchangeModule,
    TurnModule,
    EffectsModule,
    QuizModule,
    VictoryModule,
    EngineModule,
  ],
  providers: [
    {
      provide: SESSION_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('SESSION_STORE_REDIS_URL') || config.get<string>('REDIS_URL');
        if (redisUrl) {
          return new RedisSessionStore(redisUrl);
        }
        return new InMemorySessionStore();
      },
    },
    PayloadValidationService,
    RealtimeApiGateway,
    AuthMessageHandler,
    CatalogMessageHandler,
    MessagingMessageHandler,
    UserMessageHandler,
    GameMessageHandler,
    GameContentService,
  ],
})
export class ApiModule {}
