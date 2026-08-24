#pragma once

#include <string>
#include <optional>
#include <vector>

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

struct RoomState
{
    int id = 0;
    std::string name;
    std::string gameType;
    std::string gameName;
    std::string gameSummary;
    std::string gameEngine;
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
};

struct RoomCommandRequest final
{
    RoomCommand command = RoomCommand::Info;
    bool spectator = false;
    std::string message;
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
};
}
