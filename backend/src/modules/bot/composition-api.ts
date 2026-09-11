/** Nest composition entry; application consumers use public-api. */
export { BotModule } from './module/bot.module';
export {
  BOT_ROOM_REPOSITORY,
  type BotRoomRepository,
} from './application/ports/bot-room.repository';
