import { User } from '../user/public-api';
import { ChatMessage } from '../chat/infrastructure/persistence/typeorm/entities/chat-message.entity';
import { ChatSettingsEntity } from '../chat/infrastructure/persistence/typeorm/entities/chat-settings.entity';
import { PrivateMessageEntity } from '../messaging/infrastructure/persistence/typeorm/entities/private-message.entity';
import { SocialProfileEntity } from '../social/infrastructure/persistence/typeorm/entities/social-profile.entity';
import { SocialRelationshipEntity } from '../social/infrastructure/persistence/typeorm/entities/social-relationship.entity';
import { SocialProfileSettingsEntity } from '../social/infrastructure/persistence/typeorm/entities/social-profile-settings.entity';
import { Room } from '../room/infrastructure/persistence/typeorm/entities/room.entity';
import { RoomParticipant } from '../room/infrastructure/persistence/typeorm/entities/room-participant.entity';
import { RoomBot } from '../room/infrastructure/persistence/typeorm/entities/room-bot.entity';
import { RoomMaintenanceSettingsEntity } from '../room/infrastructure/persistence/typeorm/entities/room-maintenance-settings.entity';
import { BotName } from '../bot/infrastructure/persistence/typeorm/entities/bot-name.entity';
import { GameMatchEntity } from '../stats/infrastructure/persistence/typeorm/entities/game-match.entity';
import { GameMatchPlayerEntity } from '../stats/infrastructure/persistence/typeorm/entities/game-match-player.entity';
import { RoleDefinitionEntity } from '../admin/infrastructure/persistence/typeorm/entities/role-definition.entity';
import { GameCategoryEntity } from '../game/engine/infrastructure/persistence/typeorm/entities/game-category.entity';
import { GameCategoryAssignmentEntity } from '../game/engine/infrastructure/persistence/typeorm/entities/game-category-assignment.entity';
import { GameCatalogOverrideEntity } from '../game/engine/infrastructure/persistence/typeorm/entities/game-catalog-override.entity';
import { BotSettingsEntity } from '../game/core/infrastructure/persistence/typeorm/entities/bot-settings.entity';
import { BugReportEntity } from '../bug-reports/infrastructure/persistence/typeorm/entities/bug-report.entity';
import { BugReportCommentEntity } from '../bug-reports/infrastructure/persistence/typeorm/entities/bug-report-comment.entity';
import { NotificationInboxItemEntity } from '../notification/infrastructure/persistence/typeorm/entities/notification-inbox-item.entity';
import { VaultRoomSnapshotEntity } from '../vault/infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';

export const ORM_ENTITIES = [
  User,
  ChatMessage,
  ChatSettingsEntity,
  PrivateMessageEntity,
  SocialProfileEntity,
  SocialRelationshipEntity,
  SocialProfileSettingsEntity,
  Room,
  RoomParticipant,
  RoomBot,
  RoomMaintenanceSettingsEntity,
  BotName,
  GameMatchEntity,
  GameMatchPlayerEntity,
  RoleDefinitionEntity,
  GameCategoryEntity,
  GameCategoryAssignmentEntity,
  GameCatalogOverrideEntity,
  BotSettingsEntity,
  BugReportEntity,
  BugReportCommentEntity,
  NotificationInboxItemEntity,
  VaultRoomSnapshotEntity,
];

