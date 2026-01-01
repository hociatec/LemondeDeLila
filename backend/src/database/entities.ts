import { User } from '../user/entities/user.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { PrivateMessage } from '../messaging/entities/private-message.entity';
import { SocialProfile } from '../social/entities/social-profile.entity';
import { SocialRelationship } from '../social/entities/social-relationship.entity';
import { Room } from '../room/entities/room.entity';
import { RoomParticipant } from '../room/entities/room-participant.entity';
import { RoomBot } from '../room/entities/room-bot.entity';
import { BotName } from '../bot/entities/bot-name.entity';
import { GameMatch } from '../stats/entities/game-match.entity';
import { GameMatchPlayer } from '../stats/entities/game-match-player.entity';
import { RoleDefinitionEntity } from '../admin/entities/role-definition.entity';
import { GameCategoryEntity } from '../game/engine/entities/game-category.entity';
import { GameCategoryAssignmentEntity } from '../game/engine/entities/game-category-assignment.entity';
import { GameCatalogOverrideEntity } from '../game/engine/entities/game-catalog-override.entity';
import { BotSettingsEntity } from '../game/modules/bot/entities/bot-settings.entity';
import { BugReportEntity } from '../bug-reports/entities/bug-report.entity';

export const ORM_ENTITIES = [
  User,
  ChatMessage,
  PrivateMessage,
  SocialProfile,
  SocialRelationship,
  Room,
  RoomParticipant,
  RoomBot,
  BotName,
  GameMatch,
  GameMatchPlayer,
  RoleDefinitionEntity,
  GameCategoryEntity,
  GameCategoryAssignmentEntity,
  GameCatalogOverrideEntity,
  BotSettingsEntity,
  BugReportEntity,
];
