import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './user/entities/user.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';
import { PrivateMessage } from './messaging/entities/private-message.entity';
import { Room } from './room/entities/room.entity';
import { RoomParticipant } from './room/entities/room-participant.entity';
import { RoomBot } from './room/entities/room-bot.entity';
import { BotName } from './bot/entities/bot-name.entity';

const {
  DATABASE_URL,
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'le_monde_de_lila',
} = process.env;

const base = DATABASE_URL
  ? {
      type: 'mysql' as const,
      url: DATABASE_URL,
    }
  : {
      type: 'mysql' as const,
      host: DB_HOST,
      port: parseInt(DB_PORT, 10),
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    };

export default new DataSource({
  ...base,
  entities: [User, ChatMessage, PrivateMessage, Room, RoomParticipant, RoomBot, BotName],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: false,
});
