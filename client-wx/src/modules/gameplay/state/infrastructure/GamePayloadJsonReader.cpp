#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

#include <algorithm>
#include <cctype>
#include <limits>
#include <stdexcept>

namespace lila::modules::gameplay::infrastructure::detail
{
namespace
{
[[noreturn]] void InvalidField(const char* field, const char* expected)
{
    throw std::runtime_error(
        std::string("Champ gameplay invalide '") + field + "' (" + expected + ").");
}
}

JsonFieldPresence FieldPresence(const nlohmann::json& value, const char* field)
{
    if (!value.is_object()) InvalidField(field, "objet parent attendu");
    const auto found = value.find(field);
    if (found == value.end()) return JsonFieldPresence::Absent;
    return found->is_null() ? JsonFieldPresence::Null : JsonFieldPresence::Value;
}

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
    if (found == value.end() || found->is_null()) return {};
    if (!found->is_string()) InvalidField(field, "chaine attendue");
    auto decoded = found->get<std::string>();
    if (decoded.size() > 16 * 1024)
        InvalidField(field, "chaine trop volumineuse");
    return decoded;
}

int ReadInt(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    if (found == value.end() || found->is_null()) return 0;
    if (!found->is_number_integer()) InvalidField(field, "entier attendu");
    const auto decoded = found->get<std::int64_t>();
    if (decoded < std::numeric_limits<int>::min() ||
        decoded > std::numeric_limits<int>::max())
        InvalidField(field, "entier hors limites");
    return static_cast<int>(decoded);
}

int ReadRequiredInt(const nlohmann::json& value, const char* field)
{
    const auto presence = FieldPresence(value, field);
    if (presence == JsonFieldPresence::Absent) InvalidField(field, "champ absent");
    if (presence == JsonFieldPresence::Null) InvalidField(field, "null interdit");
    return ReadInt(value, field);
}

std::string ReadRequiredString(const nlohmann::json& value, const char* field)
{
    const auto presence = FieldPresence(value, field);
    if (presence == JsonFieldPresence::Absent) InvalidField(field, "champ absent");
    if (presence == JsonFieldPresence::Null) InvalidField(field, "null interdit");
    return ReadString(value, field);
}

std::optional<int> ReadOptionalInt(const nlohmann::json& value, const char* field)
{
    const auto presence = FieldPresence(value, field);
    if (presence == JsonFieldPresence::Absent || presence == JsonFieldPresence::Null)
        return std::nullopt;
    return ReadInt(value, field);
}

std::optional<int> ReadOptionalPlayerId(const nlohmann::json& value, const char* field)
{
    const auto id = ReadOptionalInt(value, field);
    return id && *id != 0 ? id : std::nullopt;
}

bool ReadBool(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    if (found == value.end() || found->is_null()) return false;
    if (!found->is_boolean()) InvalidField(field, "booleen attendu");
    return found->get<bool>();
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
