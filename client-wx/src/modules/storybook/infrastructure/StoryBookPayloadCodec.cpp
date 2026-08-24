#include "modules/storybook/infrastructure/StoryBookPayloadCodec.h"

#include <string>

#include <nlohmann/json.hpp>

#include "shared/data/json/JsonReaders.h"
#include "shared/errors/domain/AppError.h"
#include "shared/errors/catalog/ErrorMessages.h"

namespace lila::modules::storybook::infrastructure::codec
{
namespace
{
[[noreturn]] void ThrowInvalidPayload(const std::string& details)
{
    throw lila::shared::errors::AppException(
        lila::shared::errors::ToAppError(
            lila::shared::errors::ErrorCode::JsonCorrupted,
            lila::shared::errors::StoryBookPayloadInvalid,
            details));
}

domain::StoryBookCounts ReadCounts(const nlohmann::json& source)
{
    if (!source.is_object())
    {
        ThrowInvalidPayload("Story book counts must be an object.");
    }

    domain::StoryBookCounts counts{
        .finished = lila::shared::data::json::ReadRequiredInteger(source, "finished"),
        .quit = lila::shared::data::json::ReadRequiredInteger(source, "quit"),
        .won = lila::shared::data::json::ReadRequiredInteger(source, "won"),
        .lost = lila::shared::data::json::ReadRequiredInteger(source, "lost"),
    };
    if (counts.finished < 0 || counts.quit < 0 || counts.won < 0 || counts.lost < 0)
    {
        ThrowInvalidPayload("Story book counts must not be negative.");
    }
    return counts;
}

domain::StoryBookGame ReadGame(const nlohmann::json& source)
{
    if (!source.is_object())
    {
        ThrowInvalidPayload("Each story book game must be an object.");
    }

    const auto withBots = source.find("withBots");
    const auto withoutBots = source.find("withoutBots");
    if (withBots == source.end() || withoutBots == source.end())
    {
        ThrowInvalidPayload("Story book game modes are missing.");
    }

    domain::StoryBookGame game{
        .gameType = lila::shared::data::json::ReadRequiredString(source, "gameType"),
        .gameName = lila::shared::data::json::ReadRequiredString(source, "gameName"),
        .withBots = ReadCounts(*withBots),
        .withoutBots = ReadCounts(*withoutBots),
    };
    if (game.gameType.empty() || game.gameName.empty())
    {
        ThrowInvalidPayload("Story book game identity must not be empty.");
    }
    return game;
}
}

std::vector<domain::StoryBookGame> ReadStoryBookPayload(const nlohmann::json& payload)
{
    if (!payload.is_object())
    {
        ThrowInvalidPayload("Story book payload must be an object.");
    }
    const auto games = payload.find("games");
    if (games == payload.end() || !games->is_array())
    {
        ThrowInvalidPayload("Story book games must be an array.");
    }

    std::vector<domain::StoryBookGame> result;
    result.reserve(games->size());
    for (const auto& game : *games)
    {
        result.push_back(ReadGame(game));
    }
    return result;
}
}
