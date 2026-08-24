#include "modules/presence/infrastructure/PresencePayloadCodec.h"

#include <algorithm>
#include <utility>

#include <nlohmann/json.hpp>

namespace lila::modules::presence::infrastructure
{
namespace
{
int ScoreAvailability(const std::string& value)
{
    std::string normalized = value;
    std::ranges::transform(normalized, normalized.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (normalized == "available" || normalized == "disponible")
    {
        return 0;
    }
    if (normalized == "occupied" || normalized == "occupe")
    {
        return 1;
    }
    if (normalized == "absent")
    {
        return 2;
    }
    return 3;
}

int ScoreActivity(const std::string& value)
{
    std::string normalized = value;
    std::ranges::transform(normalized, normalized.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (normalized == "table")
    {
        return 0;
    }
    if (normalized == "messaging" || normalized == "social" || normalized == "notifications" || normalized == "other")
    {
        return 1;
    }
    if (normalized == "chat")
    {
        return 2;
    }
    if (normalized == "tavern" || normalized == "stats")
    {
        return 3;
    }
    return 4;
}

std::string ReadString(const nlohmann::json& node, const char* key, std::string fallback = {})
{
    const auto it = node.find(key);
    return it != node.end() && it->is_string() ? it->get<std::string>() : std::move(fallback);
}
}

std::optional<std::vector<domain::PresencePlayer>> ReadPresenceUpdate(const std::string& rawJson)
{
    if (rawJson.find("presence-update") == std::string::npos)
    {
        return std::nullopt;
    }

    const auto document = nlohmann::json::parse(rawJson);
    if (document.value("type", std::string()) != "presence-update" || !document.contains("players") || !document["players"].is_array())
    {
        return std::nullopt;
    }

    std::vector<domain::PresencePlayer> players;
    for (const auto& item : document["players"])
    {
        if (!item.contains("id") || !item["id"].is_number_integer() || !item.contains("username") || !item["username"].is_string())
        {
            continue;
        }

        domain::PresencePlayer player;
        player.id = item["id"].get<int>();
        player.username = item["username"].get<std::string>();
        player.activity = ReadString(item, "activity", "home");
        player.availability = ReadString(item, "availability");
        player.location = ReadString(item, "location");
        const auto room = item.find("currentRoom");
        if (room != item.end() && room->is_object())
        {
            if (room->contains("id") && (*room)["id"].is_number_integer())
            {
                player.currentRoomId = (*room)["id"].get<int>();
            }
            player.currentRoomName = ReadString(*room, "name");
        }
        players.push_back(std::move(player));
    }

    std::ranges::sort(
        players,
        [](const domain::PresencePlayer& left, const domain::PresencePlayer& right)
        {
            if (ScoreAvailability(left.availability) != ScoreAvailability(right.availability))
            {
                return ScoreAvailability(left.availability) < ScoreAvailability(right.availability);
            }
            if (ScoreActivity(left.activity) != ScoreActivity(right.activity))
            {
                return ScoreActivity(left.activity) < ScoreActivity(right.activity);
            }
            return left.username < right.username;
        });
    return players;
}
}
