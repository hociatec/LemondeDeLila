import { User } from '../user/entities/user.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { ChatSettingsEntity } from '../chat/entities/chat-settings.entity';
import { PrivateMessage } from '../messaging/entities/private-message.entity';
import { SocialProfile } from '../social/entities/social-profile.entity';
import { SocialRelationship } from '../social/entities/social-relationship.entity';
import { SocialProfileSettingsEntity } from '../social/entities/social-profile-settings.entity';
import { Room } from '../room/entities/room.entity';
import { RoomParticipant } from '../room/entities/room-participant.entity';
import { RoomBot } from '../room/entities/room-bot.entity';
import { RoomMaintenanceSettingsEntity } from '../room/entities/room-maintenance-settings.entity';
import { BotName } from '../bot/entities/bot-name.entity';
import { GameMatch } from '../stats/entities/game-match.entity';
import { GameMatchPlayer } from '../stats/entities/game-match-player.entity';
import { RoleDefinitionEntity } from '../admin/entities/role-definition.entity';
import { GameCategoryEntity } from '../game/engine/entities/game-category.entity';
import { GameCategoryAssignmentEntity } from '../game/engine/entities/game-category-assignment.entity';
import { GameCatalogOverrideEntity } from '../game/engine/entities/game-catalog-override.entity';
import { BotSettingsEntity } from '../game/modules/bot/entities/bot-settings.entity';
import { BugReportEntity } from '../bug-reports/entities/bug-report.entity';
import { BugReportCommentEntity } from '../bug-reports/entities/bug-report-comment.entity';

export const ORM_ENTITIES = [
  User,
  ChatMessage,
  ChatSettingsEntity,
  PrivateMessage,
  SocialProfile,
  SocialRelationship,
  SocialProfileSettingsEntity,
  Room,
  RoomParticipant,
  RoomBot,
  RoomMaintenanceSettingsEntity,
  BotName,
  GameMatch,
  GameMatchPlayer,
  RoleDefinitionEntity,
  GameCategoryEntity,
  GameCategoryAssignmentEntity,
  GameCatalogOverrideEntity,
  BotSettingsEntity,
  BugReportEntity,
  BugReportCommentEntity,
];
