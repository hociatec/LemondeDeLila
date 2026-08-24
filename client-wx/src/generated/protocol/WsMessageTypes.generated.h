// Generated from backend WS_EVENTS. Do not edit manually.
#pragma once

#include <string_view>

namespace lila::shared::network::ws::types
{
namespace api
{
inline constexpr std::string_view Capabilities = "api.capabilities";
}

namespace chat
{
inline constexpr std::string_view Message = "chat-message";
inline constexpr std::string_view MessageUpdated = "chat-message.updated";
inline constexpr std::string_view MessageDeleted = "chat-message.deleted";
inline constexpr std::string_view Send = "chat-send";
inline constexpr std::string_view Edit = "chat-edit";
inline constexpr std::string_view Delete = "chat-delete";
inline constexpr std::string_view History = "chat-history";
inline constexpr std::string_view Error = "error";
inline constexpr std::string_view PresenceContext = "presence-context";
inline constexpr std::string_view PresenceActivity = "presence-activity";
}

namespace presence
{
inline constexpr std::string_view Update = "presence-update";
}

namespace auth
{
inline constexpr std::string_view Login = "auth.login";
inline constexpr std::string_view Logout = "auth.logout";
inline constexpr std::string_view Refresh = "auth.refresh";
inline constexpr std::string_view Register = "auth.register";
inline constexpr std::string_view LoginOk = "auth.login.ok";
inline constexpr std::string_view LogoutOk = "auth.logout.ok";
inline constexpr std::string_view RefreshOk = "auth.refresh.ok";
inline constexpr std::string_view RegisterOk = "auth.register.ok";
}

namespace users
{
inline constexpr std::string_view List = "users.list";
inline constexpr std::string_view Get = "users.get";
}

namespace social
{
inline constexpr std::string_view FriendsList = "social.friends.list";
inline constexpr std::string_view FriendsRequests = "social.friends.requests";
inline constexpr std::string_view FriendsBlocked = "social.friends.blocked";
inline constexpr std::string_view FriendsRequest = "social.friends.request";
inline constexpr std::string_view FriendsAccept = "social.friends.accept";
inline constexpr std::string_view FriendsReject = "social.friends.reject";
inline constexpr std::string_view FriendsCancel = "social.friends.cancel";
inline constexpr std::string_view FriendsRemove = "social.friends.remove";
inline constexpr std::string_view FriendsBlock = "social.friends.block";
inline constexpr std::string_view FriendsUnblock = "social.friends.unblock";
inline constexpr std::string_view ProfileGet = "social.profile.get";
inline constexpr std::string_view ProfileUpdate = "social.profile.update";
inline constexpr std::string_view UserSearch = "social.user.search";
inline constexpr std::string_view FriendAccepted = "social.friend.accepted";
inline constexpr std::string_view FriendRequested = "social.friend.requested";
inline constexpr std::string_view FriendRejected = "social.friend.rejected";
inline constexpr std::string_view FriendConnected = "social.friend.connected";
inline constexpr std::string_view FriendDisconnected = "social.friend.disconnected";
}

namespace messaging
{
inline constexpr std::string_view Conversation = "messaging.conversation";
inline constexpr std::string_view Messages = "messaging.messages";
inline constexpr std::string_view Send = "messaging.send";
inline constexpr std::string_view Delete = "messaging.delete";
inline constexpr std::string_view Restore = "messaging.restore";
inline constexpr std::string_view Purge = "messaging.purge";
inline constexpr std::string_view Search = "messaging.search";
inline constexpr std::string_view MarkRead = "messaging.markRead";
inline constexpr std::string_view MessageSent = "messaging.message";
inline constexpr std::string_view MessageDeleted = "messaging.deleted";
inline constexpr std::string_view MessageRestored = "messaging.restored";
inline constexpr std::string_view MessagePurged = "messaging.purged";
inline constexpr std::string_view User = "messaging.user";
}

namespace admin
{
namespace clientUpdate
{
inline constexpr std::string_view Announce = "admin.client.update.announce";
inline constexpr std::string_view ForceLatest = "admin.client.update.forceLatest";
inline constexpr std::string_view Schedule = "admin.client.update.schedule";
}

namespace users
{
inline constexpr std::string_view List = "admin.users.list";
inline constexpr std::string_view Get = "admin.users.get";
inline constexpr std::string_view Ban = "admin.users.ban";
inline constexpr std::string_view Unban = "admin.users.unban";
inline constexpr std::string_view Delete = "admin.users.delete";
inline constexpr std::string_view Roles = "admin.users.roles";
inline constexpr std::string_view RolesUpdated = "admin.users.rolesUpdated";
}

namespace games
{
inline constexpr std::string_view List = "admin.games.list";
inline constexpr std::string_view SetEnabled = "admin.games.setEnabled";
inline constexpr std::string_view Update = "admin.games.update";
inline constexpr std::string_view Reset = "admin.games.reset";
inline constexpr std::string_view Categories = "admin.games.categories";
inline constexpr std::string_view CategoryCreate = "admin.games.category.create";
inline constexpr std::string_view CategoryUpdate = "admin.games.category.update";
inline constexpr std::string_view CategoryAssign = "admin.games.category.assign";
inline constexpr std::string_view CategoryDelete = "admin.games.category.delete";
}

namespace roles
{
inline constexpr std::string_view List = "admin.roles.list";
inline constexpr std::string_view Definitions = "admin.roles.definitions";
inline constexpr std::string_view Create = "admin.roles.create";
inline constexpr std::string_view Update = "admin.roles.update";
inline constexpr std::string_view Delete = "admin.roles.delete";
}

namespace logs
{
inline constexpr std::string_view Download = "admin.logs.download";
}

inline constexpr std::string_view Broadcast = "admin.broadcast";
namespace chat
{
inline constexpr std::string_view Messages = "admin.chat.messages";
inline constexpr std::string_view SettingsGet = "admin.chat.settings.get";
inline constexpr std::string_view SettingsUpdate = "admin.chat.settings.update";
inline constexpr std::string_view Delete = "admin.chat.delete";
inline constexpr std::string_view Clear = "admin.chat.clear";
inline constexpr std::string_view Ban = "admin.chat.ban";
inline constexpr std::string_view Unban = "admin.chat.unban";
}

namespace rooms
{
inline constexpr std::string_view Cleanup = "admin.rooms.cleanup";
inline constexpr std::string_view List = "admin.rooms.list";
inline constexpr std::string_view Destroy = "admin.rooms.destroy";
inline constexpr std::string_view SettingsGet = "admin.rooms.settings.get";
inline constexpr std::string_view SettingsUpdate = "admin.rooms.settings.update";
}

namespace profile
{
inline constexpr std::string_view SettingsGet = "admin.profile.settings.get";
inline constexpr std::string_view SettingsUpdate = "admin.profile.settings.update";
}

namespace stats
{
inline constexpr std::string_view ResetAll = "admin.stats.resetAll";
}

namespace bots
{
inline constexpr std::string_view NamesList = "admin.bots.names.list";
inline constexpr std::string_view SettingsGet = "admin.bots.settings.get";
inline constexpr std::string_view SettingsUpdate = "admin.bots.settings.update";
inline constexpr std::string_view NameCreate = "admin.bots.name.create";
inline constexpr std::string_view NameUpdate = "admin.bots.name.update";
inline constexpr std::string_view NameDelete = "admin.bots.name.delete";
}

namespace perf
{
inline constexpr std::string_view Snapshot = "admin.perf.snapshot";
}

namespace bugReports
{
inline constexpr std::string_view Create = "admin.bugReports.create";
inline constexpr std::string_view List = "admin.bugReports.list";
inline constexpr std::string_view Get = "admin.bugReports.get";
inline constexpr std::string_view Update = "admin.bugReports.update";
inline constexpr std::string_view UpdateStatus = "admin.bugReports.updateStatus";
inline constexpr std::string_view Delete = "admin.bugReports.delete";
inline constexpr std::string_view CommentsList = "admin.bugReports.comments.list";
inline constexpr std::string_view CommentsAdd = "admin.bugReports.comments.add";
}

namespace quiz
{
namespace mnemo
{
inline constexpr std::string_view Categories = "admin.quiz.mnemo.categories";
inline constexpr std::string_view CategoryCreate = "admin.quiz.mnemo.category.create";
inline constexpr std::string_view CategoryUpdate = "admin.quiz.mnemo.category.update";
inline constexpr std::string_view CategoryDelete = "admin.quiz.mnemo.category.delete";
inline constexpr std::string_view Questions = "admin.quiz.mnemo.questions";
inline constexpr std::string_view QuestionCreate = "admin.quiz.mnemo.question.create";
inline constexpr std::string_view QuestionUpdate = "admin.quiz.mnemo.question.update";
inline constexpr std::string_view QuestionDelete = "admin.quiz.mnemo.question.delete";
}

}

}

namespace notify
{
inline constexpr std::string_view Connected = "notify.connected";
inline constexpr std::string_view Counts = "notify.counts";
inline constexpr std::string_view CountsGet = "notify.counts.get";
namespace inbox
{
inline constexpr std::string_view List = "notify.inbox.list";
inline constexpr std::string_view Delete = "notify.inbox.delete";
inline constexpr std::string_view MarkRead = "notify.inbox.markRead";
inline constexpr std::string_view Snapshot = "notify.inbox.snapshot";
inline constexpr std::string_view Item = "notify.inbox.item";
inline constexpr std::string_view Removed = "notify.inbox.removed";
inline constexpr std::string_view Send = "notify.admin_contact.send";
inline constexpr std::string_view Reply = "notify.admin_contact.reply";
inline constexpr std::string_view SetHandled = "notify.admin_contact.setHandled";
inline constexpr std::string_view SetStatus = "notify.admin_contact.setStatus";
inline constexpr std::string_view CycleStatus = "notify.admin_contact.cycleStatus";
inline constexpr std::string_view Threads = "notify.admin_contact.threads";
inline constexpr std::string_view DeleteThread = "notify.admin_contact.deleteThread";
inline constexpr std::string_view Sent = "notify.admin_contact.sent";
inline constexpr std::string_view Error = "notify.admin_contact.error";
}

}

namespace clientUpdate
{
inline constexpr std::string_view Available = "client.update.available";
inline constexpr std::string_view Required = "client.update.required";
inline constexpr std::string_view Imminent = "client.update.imminent";
}

namespace room
{
inline constexpr std::string_view RestoreReady = "rooms.restore.ready";
}

namespace system
{
inline constexpr std::string_view ServerDisconnect = "server.disconnect";
}

}
