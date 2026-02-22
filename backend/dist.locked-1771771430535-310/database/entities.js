"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORM_ENTITIES = void 0;
const user_entity_1 = require("../user/entities/user.entity");
const chat_message_entity_1 = require("../chat/entities/chat-message.entity");
const chat_settings_entity_1 = require("../chat/entities/chat-settings.entity");
const private_message_entity_1 = require("../messaging/entities/private-message.entity");
const social_profile_entity_1 = require("../social/entities/social-profile.entity");
const social_relationship_entity_1 = require("../social/entities/social-relationship.entity");
const social_profile_settings_entity_1 = require("../social/entities/social-profile-settings.entity");
const room_entity_1 = require("../room/entities/room.entity");
const room_participant_entity_1 = require("../room/entities/room-participant.entity");
const room_bot_entity_1 = require("../room/entities/room-bot.entity");
const room_maintenance_settings_entity_1 = require("../room/entities/room-maintenance-settings.entity");
const bot_name_entity_1 = require("../bot/entities/bot-name.entity");
const game_match_entity_1 = require("../stats/entities/game-match.entity");
const game_match_player_entity_1 = require("../stats/entities/game-match-player.entity");
const role_definition_entity_1 = require("../admin/entities/role-definition.entity");
const game_category_entity_1 = require("../game/engine/entities/game-category.entity");
const game_category_assignment_entity_1 = require("../game/engine/entities/game-category-assignment.entity");
const game_catalog_override_entity_1 = require("../game/engine/entities/game-catalog-override.entity");
const bot_settings_entity_1 = require("../game/modules/bot/entities/bot-settings.entity");
const bug_report_entity_1 = require("../bug-reports/entities/bug-report.entity");
const bug_report_comment_entity_1 = require("../bug-reports/entities/bug-report-comment.entity");
const notification_inbox_item_entity_1 = require("../notification/entities/notification-inbox-item.entity");
const vault_room_snapshot_entity_1 = require("../vault/entities/vault-room-snapshot.entity");
exports.ORM_ENTITIES = [
    user_entity_1.User,
    chat_message_entity_1.ChatMessage,
    chat_settings_entity_1.ChatSettingsEntity,
    private_message_entity_1.PrivateMessage,
    social_profile_entity_1.SocialProfile,
    social_relationship_entity_1.SocialRelationship,
    social_profile_settings_entity_1.SocialProfileSettingsEntity,
    room_entity_1.Room,
    room_participant_entity_1.RoomParticipant,
    room_bot_entity_1.RoomBot,
    room_maintenance_settings_entity_1.RoomMaintenanceSettingsEntity,
    bot_name_entity_1.BotName,
    game_match_entity_1.GameMatch,
    game_match_player_entity_1.GameMatchPlayer,
    role_definition_entity_1.RoleDefinitionEntity,
    game_category_entity_1.GameCategoryEntity,
    game_category_assignment_entity_1.GameCategoryAssignmentEntity,
    game_catalog_override_entity_1.GameCatalogOverrideEntity,
    bot_settings_entity_1.BotSettingsEntity,
    bug_report_entity_1.BugReportEntity,
    bug_report_comment_entity_1.BugReportCommentEntity,
    notification_inbox_item_entity_1.NotificationInboxItem,
    vault_room_snapshot_entity_1.VaultRoomSnapshotEntity,
];
//# sourceMappingURL=entities.js.map