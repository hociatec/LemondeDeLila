#include "modules/gameplay/state/infrastructure/GamePlayerValuesDecoder.h"

#include <map>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::optional<double> Number(const nlohmann::json& value)
{
    return value.is_number() ? std::optional<double>(value.get<double>()) : std::nullopt;
}

int PlayerId(const std::string& key)
{
    try { return std::stoi(key); } catch (const std::exception&) { return 0; }
}
}

std::optional<domain::GameScoreView> GamePlayerValuesDecoder::Score(const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameScoreView result;
    const auto byPlayer = raw.find("byPlayer");
    if (byPlayer != raw.end() && byPlayer->is_object())
        for (const auto& item : byPlayer->items())
            if (const auto value = Number(item.value()))
                result.byPlayer.emplace(PlayerId(item.key()), *value);
    const auto leaderboard = raw.find("leaderboard");
    if (leaderboard != raw.end() && leaderboard->is_array())
        for (const auto& item : *leaderboard)
        {
            if (!item.is_object()) continue;
            domain::GameScoreEntry entry;
            entry.playerId = detail::ReadInt(item, "playerId");
            entry.rank = detail::ReadInt(item, "rank");
            if (const auto score = item.find("score"); score != item.end())
                entry.score = Number(*score).value_or(0);
            result.leaderboard.push_back(entry);
        }
    return result.byPlayer.empty() && result.leaderboard.empty()
        ? std::nullopt : std::optional<domain::GameScoreView>(std::move(result));
}

std::optional<domain::GameResourcesView> GamePlayerValuesDecoder::Resources(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    std::map<int, domain::GamePlayerAmounts> players;
    for (const auto& resource : raw.items())
    {
        if (!resource.value().is_object()) continue;
        for (const auto& item : resource.value().items())
            if (const auto value = Number(item.value()))
            {
                const int id = PlayerId(item.key());
                auto& player = players[id];
                player.playerId = id;
                player.values.push_back({resource.key(), *value});
            }
    }
    if (players.empty()) return std::nullopt;
    domain::GameResourcesView result;
    for (auto& [id, player] : players) result.players.push_back(std::move(player));
    return result;
}

std::optional<domain::GameCountersView> GamePlayerValuesDecoder::Counters(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameCountersView result;
    for (const auto& item : raw.items())
        if (const auto value = Number(item.value()))
            result.values.push_back({item.key(), *value});
    return result.values.empty() ? std::nullopt
                                 : std::optional<domain::GameCountersView>(std::move(result));
}

std::optional<domain::GameStatusView> GamePlayerValuesDecoder::Status(
    const nlohmann::json& raw)
{
    const auto byId = raw.find("byId");
    if (byId == raw.end() || !byId->is_object() || byId->empty()) return std::nullopt;
    domain::GameStatusView result;
    for (const auto& status : byId->items())
    {
        if (!status.value().is_object()) continue;
        for (const auto& player : status.value().items())
        {
            if (!player.value().is_object()) continue;
            domain::GameStatusValue value;
            value.id = status.key();
            value.playerId = PlayerId(player.key());
            value.scope = detail::ReadString(player.value(), "scope");
            const auto remaining = player.value().find("remaining");
            if (remaining != player.value().end() && remaining->is_number_integer())
                value.remaining = remaining->get<int>();
            result.values.push_back(std::move(value));
        }
    }
    return result.values.empty() ? std::nullopt
                                 : std::optional<domain::GameStatusView>(std::move(result));
}
}
