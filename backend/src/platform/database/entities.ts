import { User } from '../../modules/user/public-api';
import { ChatMessage } from '../../modules/chat/infrastructure/persistence/typeorm/entities/chat-message.entity';
import { ChatSettingsEntity } from '../../modules/chat/infrastructure/persistence/typeorm/entities/chat-settings.entity';
import { PrivateMessageEntity } from '../../modules/messaging/infrastructure/persistence/typeorm/entities/private-message.entity';
import { SocialProfileEntity } from '../../modules/social/infrastructure/persistence/typeorm/entities/social-profile.entity';
import { SocialRelationshipEntity } from '../../modules/social/infrastructure/persistence/typeorm/entities/social-relationship.entity';
import { SocialProfileSettingsEntity } from '../../modules/social/infrastructure/persistence/typeorm/entities/social-profile-settings.entity';
import { Room } from '../../modules/room/infrastructure/persistence/typeorm/entities/room.entity';
import { RoomParticipant } from '../../modules/room/infrastructure/persistence/typeorm/entities/room-participant.entity';
import { RoomBot } from '../../modules/room/infrastructure/persistence/typeorm/entities/room-bot.entity';
import { RoomMaintenanceSettingsEntity } from '../../modules/room/infrastructure/persistence/typeorm/entities/room-maintenance-settings.entity';
import { BotName } from '../../modules/bot/infrastructure/persistence/typeorm/entities/bot-name.entity';
import { GameMatchEntity } from '../../modules/stats/infrastructure/persistence/typeorm/entities/game-match.entity';
import { GameMatchPlayerEntity } from '../../modules/stats/infrastructure/persistence/typeorm/entities/game-match-player.entity';
import { RoleDefinitionEntity } from '../../modules/admin/infrastructure/persistence/typeorm/entities/role-definition.entity';
import { GameCategoryEntity } from '../../game/engine/infrastructure/persistence/typeorm/entities/game-category.entity';
import { GameCategoryAssignmentEntity } from '../../game/engine/infrastructure/persistence/typeorm/entities/game-category-assignment.entity';
import { GameCatalogOverrideEntity } from '../../game/engine/infrastructure/persistence/typeorm/entities/game-catalog-override.entity';
import { BotSettingsEntity } from '../../game/core/infrastructure/persistence/typeorm/entities/bot-settings.entity';
import { BugReportEntity } from '../../modules/bug-reports/infrastructure/persistence/typeorm/entities/bug-report.entity';
import { BugReportCommentEntity } from '../../modules/bug-reports/infrastructure/persistence/typeorm/entities/bug-report-comment.entity';
import { NotificationInboxItemEntity } from '../../modules/notification/infrastructure/persistence/typeorm/entities/notification-inbox-item.entity';
import { VaultRoomSnapshotEntity } from '../../modules/vault/infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';
import { GameSessionEntity } from '../../game/core/infrastructure/persistence/typeorm/entities/game-session.entity';
import { GameSessionEventEntity } from '../../game/core/infrastructure/persistence/typeorm/entities/game-session-event.entity';
import { GameSessionSnapshotEntity } from '../../game/core/infrastructure/persistence/typeorm/entities/game-session-snapshot.entity';

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
  GameSessionEntity,
  GameSessionEventEntity,
  GameSessionSnapshotEntity,
];
