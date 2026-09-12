import {
  BOT_ROOM_READER,
  type BotRoomReader,
} from '../application/ports/bot-room-reader.port';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessClockModule } from '../../../platform/time/public-api';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../shared/interfaces/public-api';
import {
  BOT_NAME_CACHE_CONFIG,
  type BotNameCacheConfig,
} from '../application/ports/bot-name-cache-config.port';
import {
  BOT_NAME_REPOSITORY,
  type BotNameRepository,
} from '../application/ports/bot-name.repository';
import {
  BOT_ROOM_REPOSITORY,
  type BotRoomRepository,
} from '../application/ports/bot-room.repository';
import { AddBotToRoomService } from '../application/use-cases/bot-rooms/add-bot-to-room.service';
import { AddSystemBotToRoomService } from '../application/use-cases/bot-rooms/add-system-bot-to-room.service';
import { BotRoomPolicyService } from '../application/use-cases/bot-rooms/bot-room-policy.service';
import { CountRoomBotsService } from '../application/use-cases/bot-rooms/count-room-bots.service';
import { GetLastRoomBotService } from '../application/use-cases/bot-rooms/get-last-room-bot.service';
import { GetRoomBotStatsService } from '../application/use-cases/bot-rooms/get-room-bot-stats.service';
import { RenameRoomBotService } from '../application/use-cases/bot-rooms/rename-room-bot.service';
import { RemoveAllRoomBotsService } from '../application/use-cases/bot-rooms/remove-all-room-bots.service';
import { RemoveBotFromRoomService } from '../application/use-cases/bot-rooms/remove-bot-from-room.service';
import { BotNameCacheService } from '../application/use-cases/bot-names/bot-name-cache.service';
import { BotNameNormalizerService } from '../application/use-cases/bot-names/bot-name-normalizer.service';
import { BotNameRegistryService } from '../application/use-cases/bot-names/bot-name-registry.service';
import { BotNameSelectionService } from '../application/use-cases/bot-names/bot-name-selection.service';
import { CreateBotNameService } from '../application/use-cases/bot-names/create-bot-name.service';
import { DeleteBotNameService } from '../application/use-cases/bot-names/delete-bot-name.service';
import { ListBotNamesService } from '../application/use-cases/bot-names/list-bot-names.service';
import { UpdateBotNameService } from '../application/use-cases/bot-names/update-bot-name.service';
import { BotName } from '../infrastructure/persistence/typeorm/entities/bot-name.entity';
import { createBotNameCacheConfig } from '../infrastructure/config/bot-name-cache.config';
import { BotNameTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/bot-name-typeorm.repository';

@Module({
  imports: [BusinessClockModule, TypeOrmModule.forFeature([BotName])],
  providers: [
    BotNameTypeormRepository,
    {
      provide: BOT_NAME_CACHE_CONFIG,
      useFactory: createBotNameCacheConfig,
    },
    {
      provide: BOT_NAME_REPOSITORY,
      useExisting: BotNameTypeormRepository,
    },
    {
      provide: BotRoomPolicyService,
      useFactory: () => new BotRoomPolicyService(),
    },
    {
      provide: BotNameNormalizerService,
      useFactory: () => new BotNameNormalizerService(),
    },
    {
      provide: BotNameRegistryService,
      useFactory: (botNames: BotNameRepository) =>
        new BotNameRegistryService(botNames),
      inject: [BOT_NAME_REPOSITORY],
    },
    {
      provide: BotNameCacheService,
      useFactory: (
        registry: BotNameRegistryService,
        config: BotNameCacheConfig,
        clock: BusinessClock,
      ) => new BotNameCacheService(registry, config, clock),
      inject: [BotNameRegistryService, BOT_NAME_CACHE_CONFIG, BUSINESS_CLOCK],
    },
    {
      provide: BotNameSelectionService,
      useFactory: (
        cache: BotNameCacheService,
        normalizer: BotNameNormalizerService,
      ) => new BotNameSelectionService(cache, normalizer),
      inject: [BotNameCacheService, BotNameNormalizerService],
    },
    {
      provide: ListBotNamesService,
      useFactory: (botNames: BotNameRepository) =>
        new ListBotNamesService(botNames),
      inject: [BOT_NAME_REPOSITORY],
    },
    {
      provide: CreateBotNameService,
      useFactory: (
        botNames: BotNameRepository,
        cache: BotNameCacheService,
        normalizer: BotNameNormalizerService,
      ) => new CreateBotNameService(botNames, cache, normalizer),
      inject: [
        BOT_NAME_REPOSITORY,
        BotNameCacheService,
        BotNameNormalizerService,
      ],
    },
    {
      provide: UpdateBotNameService,
      useFactory: (
        botNames: BotNameRepository,
        cache: BotNameCacheService,
        normalizer: BotNameNormalizerService,
      ) => new UpdateBotNameService(botNames, cache, normalizer),
      inject: [
        BOT_NAME_REPOSITORY,
        BotNameCacheService,
        BotNameNormalizerService,
      ],
    },
    {
      provide: DeleteBotNameService,
      useFactory: (botNames: BotNameRepository, cache: BotNameCacheService) =>
        new DeleteBotNameService(botNames, cache),
      inject: [BOT_NAME_REPOSITORY, BotNameCacheService],
    },
    {
      provide: AddBotToRoomService,
      useFactory: (
        rooms: BotRoomRepository,
        names: BotNameSelectionService,
        policy: BotRoomPolicyService,
      ) => new AddBotToRoomService(rooms, names, policy),
      inject: [
        BOT_ROOM_REPOSITORY,
        BotNameSelectionService,
        BotRoomPolicyService,
      ],
    },
    {
      provide: AddSystemBotToRoomService,
      useFactory: (
        rooms: BotRoomRepository,
        names: BotNameSelectionService,
        policy: BotRoomPolicyService,
      ) => new AddSystemBotToRoomService(rooms, names, policy),
      inject: [
        BOT_ROOM_REPOSITORY,
        BotNameSelectionService,
        BotRoomPolicyService,
      ],
    },
    {
      provide: RemoveBotFromRoomService,
      useFactory: (rooms: BotRoomRepository, policy: BotRoomPolicyService) =>
        new RemoveBotFromRoomService(rooms, policy),
      inject: [BOT_ROOM_REPOSITORY, BotRoomPolicyService],
    },
    {
      provide: GetLastRoomBotService,
      useFactory: (rooms: BotRoomReader) => new GetLastRoomBotService(rooms),
      inject: [BOT_ROOM_READER],
    },
    {
      provide: RenameRoomBotService,
      useFactory: (rooms: BotRoomRepository) => new RenameRoomBotService(rooms),
      inject: [BOT_ROOM_REPOSITORY],
    },
    {
      provide: GetRoomBotStatsService,
      useFactory: (rooms: BotRoomReader) => new GetRoomBotStatsService(rooms),
      inject: [BOT_ROOM_READER],
    },
    {
      provide: CountRoomBotsService,
      useFactory: (rooms: BotRoomReader) => new CountRoomBotsService(rooms),
      inject: [BOT_ROOM_READER],
    },
    {
      provide: RemoveAllRoomBotsService,
      useFactory: (rooms: BotRoomRepository) =>
        new RemoveAllRoomBotsService(rooms),
      inject: [BOT_ROOM_REPOSITORY],
    },
  ],
  exports: [
    AddBotToRoomService,
    AddSystemBotToRoomService,
    RemoveBotFromRoomService,
    GetLastRoomBotService,
    RenameRoomBotService,
    GetRoomBotStatsService,
    CountRoomBotsService,
    RemoveAllRoomBotsService,
    ListBotNamesService,
    CreateBotNameService,
    UpdateBotNameService,
    DeleteBotNameService,
  ],
})
export class BotModule {}
