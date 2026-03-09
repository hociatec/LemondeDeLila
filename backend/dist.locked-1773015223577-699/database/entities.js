"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ORM_ENTITIES", {
    enumerable: true,
    get: function() {
        return ORM_ENTITIES;
    }
});
const _userentity = require("../user/entities/user.entity");
const _chatmessageentity = require("../chat/entities/chat-message.entity");
const _chatsettingsentity = require("../chat/entities/chat-settings.entity");
const _privatemessageentity = require("../messaging/entities/private-message.entity");
const _socialprofileentity = require("../social/entities/social-profile.entity");
const _socialrelationshipentity = require("../social/entities/social-relationship.entity");
const _socialprofilesettingsentity = require("../social/entities/social-profile-settings.entity");
const _roomentity = require("../room/entities/room.entity");
const _roomparticipantentity = require("../room/entities/room-participant.entity");
const _roombotentity = require("../room/entities/room-bot.entity");
const _roommaintenancesettingsentity = require("../room/entities/room-maintenance-settings.entity");
const _botnameentity = require("../bot/entities/bot-name.entity");
const _gamematchentity = require("../stats/entities/game-match.entity");
const _gamematchplayerentity = require("../stats/entities/game-match-player.entity");
const _roledefinitionentity = require("../admin/entities/role-definition.entity");
const _gamecategoryentity = require("../game/engine/entities/game-category.entity");
const _gamecategoryassignmententity = require("../game/engine/entities/game-category-assignment.entity");
const _gamecatalogoverrideentity = require("../game/engine/entities/game-catalog-override.entity");
const _botsettingsentity = require("../game/modules/bot/entities/bot-settings.entity");
const _bugreportentity = require("../bug-reports/entities/bug-report.entity");
const _bugreportcommententity = require("../bug-reports/entities/bug-report-comment.entity");
const _notificationinboxitementity = require("../notification/entities/notification-inbox-item.entity");
const _vaultroomsnapshotentity = require("../vault/entities/vault-room-snapshot.entity");
const ORM_ENTITIES = [
    _userentity.User,
    _chatmessageentity.ChatMessage,
    _chatsettingsentity.ChatSettingsEntity,
    _privatemessageentity.PrivateMessage,
    _socialprofileentity.SocialProfile,
    _socialrelationshipentity.SocialRelationship,
    _socialprofilesettingsentity.SocialProfileSettingsEntity,
    _roomentity.Room,
    _roomparticipantentity.RoomParticipant,
    _roombotentity.RoomBot,
    _roommaintenancesettingsentity.RoomMaintenanceSettingsEntity,
    _botnameentity.BotName,
    _gamematchentity.GameMatch,
    _gamematchplayerentity.GameMatchPlayer,
    _roledefinitionentity.RoleDefinitionEntity,
    _gamecategoryentity.GameCategoryEntity,
    _gamecategoryassignmententity.GameCategoryAssignmentEntity,
    _gamecatalogoverrideentity.GameCatalogOverrideEntity,
    _botsettingsentity.BotSettingsEntity,
    _bugreportentity.BugReportEntity,
    _bugreportcommententity.BugReportCommentEntity,
    _notificationinboxitementity.NotificationInboxItem,
    _vaultroomsnapshotentity.VaultRoomSnapshotEntity
];
