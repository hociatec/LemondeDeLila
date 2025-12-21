import { User } from '../user/entities/user.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { PrivateMessage } from '../messaging/entities/private-message.entity';
import { Room } from '../room/entities/room.entity';
import { RoomParticipant } from '../room/entities/room-participant.entity';
import { RoomBot } from '../room/entities/room-bot.entity';
import { BotName } from '../bot/entities/bot-name.entity';

export const ORM_ENTITIES = [
  User,
  ChatMessage,
  PrivateMessage,
  Room,
  RoomParticipant,
  RoomBot,
  BotName,
];
