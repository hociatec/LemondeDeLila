#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

#include <algorithm>
#include <cctype>

namespace lila::modules::gameplay::infrastructure::detail
{
std::string Trim(std::string value)
{
    const auto notSpace = [](unsigned char ch) { return std::isspace(ch) == 0; };
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
    value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(), value.end());
    return value;
}

std::string ToUpper(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(),
        [](unsigned char ch) { return static_cast<char>(std::toupper(ch)); });
    return value;
}

std::string ReadString(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    return found != value.end() && found->is_string() ? found->get<std::string>() : std::string{};
}

int ReadInt(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    if (found == value.end()) return 0;
    if (found->is_number_integer()) return found->get<int>();
    if (!found->is_string()) return 0;
    try
    {
        return std::stoi(found->get<std::string>());
    }
    catch (...)
    {
        return 0;
    }
}

bool ReadBool(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    if (found == value.end()) return false;
    if (found->is_boolean()) return found->get<bool>();
    if (found->is_number_integer()) return found->get<int>() != 0;
    if (!found->is_string()) return false;
    const auto raw = ToUpper(Trim(found->get<std::string>()));
    return raw == "TRUE" || raw == "1" || raw == "YES" || raw == "OUI" || raw == "ON";
}

std::string ReadPlayerUsername(const nlohmann::json& stateNode, int playerId)
{
    if (playerId <= 0) return {};
    const auto players = stateNode.find("players");
    if (players == stateNode.end() || !players->is_array()) return {};
    for (const auto& player : *players)
    {
        if (player.is_object() && ReadInt(player, "id") == playerId)
            return ReadString(player, "username");
    }
    return {};
}

nlohmann::json ObjectOrEmpty(const nlohmann::json& value)
{
    return value.is_object() ? value : nlohmann::json::object();
}

const nlohmann::json& EffectiveStateNode(const nlohmann::json& payload)
{
    const auto state = payload.find("state");
    return state != payload.end() && state->is_object() ? *state : payload;
}
}
