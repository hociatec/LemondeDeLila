#include "modules/leaderboard/infrastructure/LeaderboardPayloadCodec.h"

#include <string>

#include <nlohmann/json.hpp>

#include "shared/data/json/JsonReaders.h"
#include "shared/errors/domain/AppError.h"
#include "modules/leaderboard/domain/LeaderboardErrorMessages.h"

namespace lila::modules::leaderboard::infrastructure::codec
{
namespace
{
[[noreturn]] void ThrowInvalidPayload(const std::string& details)
{
    throw lila::shared::errors::AppException(
        lila::shared::errors::ToAppError(
            lila::shared::errors::LeaderboardPayloadInvalid,
            details));
}

domain::LeaderboardGame ReadGame(const nlohmann::json& source)
{
    if (!source.is_object())
    {
        ThrowInvalidPayload("Each leaderboard game must be an object.");
    }
    domain::LeaderboardGame game{
        .gameType = lila::shared::data::json::ReadRequiredString(source, "gameType"),
        .gameName = lila::shared::data::json::ReadRequiredString(source, "gameName"),
    };
    if (game.gameType.empty() || game.gameName.empty())
    {
        ThrowInvalidPayload("Leaderboard game identity must not be empty.");
    }
    return game;
}

domain::LeaderboardEntry ReadEntry(const nlohmann::json& source)
{
    if (!source.is_object())
    {
        ThrowInvalidPayload("Each leaderboard entry must be an object.");
    }
    domain::LeaderboardEntry entry{
        .userId = lila::shared::data::json::ReadRequiredInteger(source, "userId"),
        .username = lila::shared::data::json::ReadRequiredString(source, "username"),
        .wins = lila::shared::data::json::ReadRequiredInteger(source, "wins"),
        .losses = lila::shared::data::json::ReadRequiredInteger(source, "losses"),
        .finished = lila::shared::data::json::ReadRequiredInteger(source, "finished"),
        .quit = lila::shared::data::json::ReadRequiredInteger(source, "quit"),
    };
    if (entry.userId <= 0 || entry.username.empty() || entry.wins < 0 || entry.losses < 0 ||
        entry.finished < 0 || entry.quit < 0)
    {
        ThrowInvalidPayload("Leaderboard entry values are invalid.");
    }
    return entry;
}
}

std::vector<domain::LeaderboardGame> ReadGamesPayload(const nlohmann::json& payload)
{
    if (!payload.is_object())
    {
        ThrowInvalidPayload("Leaderboard games payload must be an object.");
    }
    const auto games = payload.find("games");
    if (games == payload.end() || !games->is_array())
    {
        ThrowInvalidPayload("Leaderboard games must be an array.");
    }

    std::vector<domain::LeaderboardGame> result;
    result.reserve(games->size());
    for (const auto& game : *games)
    {
        result.push_back(ReadGame(game));
    }
    return result;
}

domain::LeaderboardTop ReadTopPayload(const nlohmann::json& payload)
{
    if (!payload.is_object())
    {
        ThrowInvalidPayload("Leaderboard top payload must be an object.");
    }
    domain::LeaderboardTop result;
    result.gameType = lila::shared::data::json::ReadRequiredString(payload, "gameType");
    const auto entries = payload.find("entries");
    if (result.gameType.empty() || entries == payload.end() || !entries->is_array())
    {
        ThrowInvalidPayload("Leaderboard top identity or entries are invalid.");
    }
    result.entries.reserve(entries->size());
    for (const auto& entry : *entries)
    {
        result.entries.push_back(ReadEntry(entry));
    }
    return result;
}
}
