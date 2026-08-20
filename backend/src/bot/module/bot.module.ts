import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomBot } from '../../room/entities/room-bot.entity';
import { Room } from '../../room/entities/room.entity';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';
import { BOT_NAME_REPOSITORY } from '../application/ports/bot-name.repository';
import { BOT_ROOM_REPOSITORY } from '../application/ports/bot-room.repository';
import { AddBotToRoomService } from '../application/use-cases/bot-rooms/add-bot-to-room.service';
import { AddSystemBotToRoomService } from '../application/use-cases/bot-rooms/add-system-bot-to-room.service';
import { BotRoomPolicyService } from '../application/use-cases/bot-rooms/bot-room-policy.service';
import { CountRoomBotsService } from '../application/use-cases/bot-rooms/count-room-bots.service';
import { GetLastRoomBotService } from '../application/use-cases/bot-rooms/get-last-room-bot.service';
import { GetRoomBotStatsService } from '../application/use-cases/bot-rooms/get-room-bot-stats.service';
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
import { BotNameTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/bot-name-typeorm.repository';
import { BotRoomTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/bot-room-typeorm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RoomBot, Room, RoomParticipant, User, BotName])],
  providers: [
    BotRoomTypeormRepository,
    BotNameTypeormRepository,
    {
      provide: BOT_ROOM_REPOSITORY,
      useExisting: BotRoomTypeormRepository,
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
      useFactory: (botNames: any) => new BotNameRegistryService(botNames),
      inject: [BOT_NAME_REPOSITORY],
    },
    {
      provide: BotNameCacheService,
      useFactory: (registry: BotNameRegistryService) =>
        new BotNameCacheService(registry),
      inject: [BotNameRegistryService],
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
      useFactory: (botNames: any) => new ListBotNamesService(botNames),
      inject: [BOT_NAME_REPOSITORY],
    },
    {
      provide: CreateBotNameService,
      useFactory: (
        botNames: any,
        cache: BotNameCacheService,
        normalizer: BotNameNormalizerService,
      ) => new CreateBotNameService(botNames, cache, normalizer),
      inject: [BOT_NAME_REPOSITORY, BotNameCacheService, BotNameNormalizerService],
    },
    {
      provide: UpdateBotNameService,
      useFactory: (
        botNames: any,
        cache: BotNameCacheService,
        normalizer: BotNameNormalizerService,
      ) => new UpdateBotNameService(botNames, cache, normalizer),
      inject: [BOT_NAME_REPOSITORY, BotNameCacheService, BotNameNormalizerService],
    },
    {
      provide: DeleteBotNameService,
      useFactory: (botNames: any, cache: BotNameCacheService) =>
        new DeleteBotNameService(botNames, cache),
      inject: [BOT_NAME_REPOSITORY, BotNameCacheService],
    },
    {
      provide: AddBotToRoomService,
      useFactory: (
        rooms: any,
        names: BotNameSelectionService,
        policy: BotRoomPolicyService,
      ) => new AddBotToRoomService(rooms, names, policy),
      inject: [BOT_ROOM_REPOSITORY, BotNameSelectionService, BotRoomPolicyService],
    },
    {
      provide: AddSystemBotToRoomService,
      useFactory: (
        rooms: any,
        names: BotNameSelectionService,
        policy: BotRoomPolicyService,
      ) => new AddSystemBotToRoomService(rooms, names, policy),
      inject: [BOT_ROOM_REPOSITORY, BotNameSelectionService, BotRoomPolicyService],
    },
    {
      provide: RemoveBotFromRoomService,
      useFactory: (rooms: any, policy: BotRoomPolicyService) =>
        new RemoveBotFromRoomService(rooms, policy),
      inject: [BOT_ROOM_REPOSITORY, BotRoomPolicyService],
    },
    {
      provide: GetLastRoomBotService,
      useFactory: (rooms: any) => new GetLastRoomBotService(rooms),
      inject: [BOT_ROOM_REPOSITORY],
    },
    {
      provide: GetRoomBotStatsService,
      useFactory: (rooms: any) => new GetRoomBotStatsService(rooms),
      inject: [BOT_ROOM_REPOSITORY],
    },
    {
      provide: CountRoomBotsService,
      useFactory: (rooms: any) => new CountRoomBotsService(rooms),
      inject: [BOT_ROOM_REPOSITORY],
    },
    {
      provide: RemoveAllRoomBotsService,
      useFactory: (rooms: any) => new RemoveAllRoomBotsService(rooms),
      inject: [BOT_ROOM_REPOSITORY],
    },
  ],
  exports: [
    AddBotToRoomService,
    AddSystemBotToRoomService,
    RemoveBotFromRoomService,
    GetLastRoomBotService,
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
