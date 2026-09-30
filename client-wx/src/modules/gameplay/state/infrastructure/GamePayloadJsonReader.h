#pragma once

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::infrastructure::detail
{
enum class JsonFieldPresence
{
    Absent,
    Null,
    Value,
};

[[nodiscard]] JsonFieldPresence FieldPresence(
    const nlohmann::json& value, const char* field);
[[nodiscard]] std::string Trim(std::string value);
[[nodiscard]] std::string ToUpper(std::string value);
[[nodiscard]] std::string ReadString(const nlohmann::json& value, const char* field);
[[nodiscard]] int ReadInt(const nlohmann::json& value, const char* field);
[[nodiscard]] int ReadRequiredInt(const nlohmann::json& value, const char* field);
[[nodiscard]] std::string ReadRequiredString(
    const nlohmann::json& value, const char* field);
[[nodiscard]] std::optional<int> ReadOptionalInt(
    const nlohmann::json& value, const char* field);
[[nodiscard]] std::optional<int> ReadOptionalPlayerId(
    const nlohmann::json& value, const char* field);
[[nodiscard]] bool ReadBool(const nlohmann::json& value, const char* field);
[[nodiscard]] std::string ReadPlayerUsername(const nlohmann::json& stateNode, int playerId);
[[nodiscard]] nlohmann::json ObjectOrEmpty(const nlohmann::json& value);
[[nodiscard]] const nlohmann::json& EffectiveStateNode(const nlohmann::json& payload);
}
