#pragma once

#include <string>
#include <optional>
#include <vector>
#include <utility>

namespace lila::modules::rooms::domain
{
struct PublicRoom
{
    int id = 0;
    std::string name;
    std::string gameType;
    std::string status;
    bool started = false;
    bool spectatorOnly = false;
    int maxPlayers = 0;
    int playersCount = 0;
    int botsCount = 0;
    std::string ownerUsername;
};

struct RoomMember
{
    int id = 0;
    std::string name;
};

struct RoomInviteCandidate final
{
    int id = 0;
    std::string username;
    std::string availability;
    bool pendingInvite = false;
};

struct TableAmbience final
{
    std::string soundId;
    std::string name;
};

struct RoomInvitation final
{
    std::string invitationId;
    int roomId = 0;
    std::string roomName;
    int fromUserId = 0;
    std::string fromUsername;
};

struct RoomState
{
    int id = 0;
    int runId = 0;
    std::string name;
    std::string gameType;
    std::string gameName;
    std::string status;
    bool started = false;
    bool isPrivate = false;
    bool chatEnabled = true;
    bool selfSpectator = false;
    int minPlayers = 0;
    int maxPlayers = 0;
    int ownerId = 0;
    std::string ownerName;
    std::vector<RoomMember> players;
    std::vector<RoomMember> spectators;
    std::vector<RoomMember> bots;
    std::vector<std::string> allowedActions;
    std::string tableAmbienceSoundId;
};

enum class RoomCommand
{
    Start,
    Reset,
    AddBot,
    RemoveBot,
    TogglePrivacy,
    SetRole,
    Info,
    SendChat,
    Ping,
    Kick,
    Ban,
    SetAmbience,
    SetOwner,
};

struct RoomCommandRequest final
{
    RoomCommandRequest() = default;
    RoomCommandRequest(
        RoomCommand requestedCommand,
        bool requestedSpectator = false,
        std::string requestedMessage = {},
        int requestedTargetUserId = 0)
        : command(requestedCommand), spectator(requestedSpectator),
          message(std::move(requestedMessage)), targetUserId(requestedTargetUserId) {}

    RoomCommand command = RoomCommand::Info;
    bool spectator = false;
    std::string message;
    int targetUserId = 0;
};

struct RoomChatMessage final
{
    int userId = 0;
    std::string username;
    std::string message;
};

enum class RoomEventType
{
    Ignored,
    StateUpdated,
    Info,
    Announcement,
    ChatMessage,
    ChatHistory,
    PrivacyChanged,
    RoleChanged,
    BotAdded,
    BotRemoved,
    ConnectionStatus,
    Closed,
    Error,
};

struct RoomEvent final
{
    RoomEventType type = RoomEventType::Ignored;
    std::optional<RoomState> room;
    std::vector<RoomChatMessage> chatMessages;
    std::string message;
    bool value = false;
    std::optional<RoomMember> member;
};
}
