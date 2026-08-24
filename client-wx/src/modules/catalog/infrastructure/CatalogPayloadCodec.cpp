#include "modules/catalog/infrastructure/CatalogPayloadCodec.h"

#include <cstddef>
#include <algorithm>
#include <string>

#include <nlohmann/json.hpp>

#include "shared/data/JsonReaders.h"
#include "shared/errors/AppError.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::catalog::infrastructure::codec
{
namespace
{
constexpr std::size_t MaximumShelfDepth = 16;

[[noreturn]] void ThrowInvalidPayload(const std::string& details)
{
    throw lila::shared::errors::AppException(
        lila::shared::errors::ToAppError(
            lila::shared::errors::ErrorCode::JsonCorrupted,
            lila::shared::errors::CatalogPayloadInvalid,
            details));
}

domain::CatalogShelf ReadShelf(const nlohmann::json& source, std::size_t depth)
{
    if (!source.is_object())
    {
        ThrowInvalidPayload("Each catalog shelf must be an object.");
    }
    if (depth > MaximumShelfDepth)
    {
        ThrowInvalidPayload("Catalog shelf nesting is too deep.");
    }

    domain::CatalogShelf shelf;
    shelf.id = lila::shared::data::json::ReadRequiredString(source, "id");
    shelf.name = lila::shared::data::json::ReadRequiredString(source, "name");
    if (shelf.id.empty() || shelf.name.empty())
    {
        ThrowInvalidPayload("Catalog shelf id and name must not be empty.");
    }

    const auto children = source.find("children");
    if (children == source.end() || children->is_null())
    {
        return shelf;
    }
    if (!children->is_array())
    {
        ThrowInvalidPayload("Catalog shelf children must be an array.");
    }

    shelf.children.reserve(children->size());
    for (const auto& child : *children)
    {
        shelf.children.push_back(ReadShelf(child, depth + 1));
    }
    return shelf;
}

std::vector<domain::CatalogGame> ReadGames(const nlohmann::json& payload)
{
    const auto games = payload.find("games");
    if (games == payload.end() || !games->is_array())
    {
        ThrowInvalidPayload("Catalog games must be an array.");
    }
    std::vector<domain::CatalogGame> result;
    result.reserve(games->size());
    for (const auto& source : *games)
    {
        if (!source.is_object())
        {
            ThrowInvalidPayload("Each catalog game must be an object.");
        }
        domain::CatalogGame game;
        game.id = lila::shared::data::json::ReadRequiredString(source, "id");
        game.name = lila::shared::data::json::ReadRequiredString(source, "name");
        game.summary = source.value("summary", std::string{});
        game.engine = source.value("engine", game.id);
        game.status = source.value("status", std::string("finished"));
        game.minPlayers = lila::shared::data::json::ReadRequiredInteger(source, "minPlayers");
        game.maxPlayers = lila::shared::data::json::ReadRequiredInteger(source, "maxPlayers");
        game.chatEnabled = source.value("chatEnabled", true);
        game.chatSoundsEnabled = source.value("chatSoundsEnabled", true);
        const auto categories = source.find("categories");
        if (game.id.empty() || game.name.empty() || game.engine.empty() || game.minPlayers <= 0 ||
            game.maxPlayers < game.minPlayers || categories == source.end() || !categories->is_array())
        {
            ThrowInvalidPayload("Catalog game fields are invalid.");
        }
        for (const auto& category : *categories)
        {
            if (!category.is_string() || category.get_ref<const std::string&>().empty())
            {
                ThrowInvalidPayload("Catalog game categories are invalid.");
            }
            game.categories.push_back(category.get<std::string>());
        }
        result.push_back(std::move(game));
    }
    return result;
}

void AttachGames(domain::CatalogShelf& shelf, const std::vector<domain::CatalogGame>& games)
{
    for (const auto& game : games)
    {
        if (std::find(game.categories.begin(), game.categories.end(), shelf.id) != game.categories.end())
        {
            shelf.games.push_back(game);
        }
    }
    for (auto& child : shelf.children)
    {
        AttachGames(child, games);
    }
}
}

std::vector<domain::CatalogShelf> ReadShelvesPayload(const nlohmann::json& payload)
{
    if (!payload.is_object())
    {
        ThrowInvalidPayload("Catalog payload must be an object.");
    }

    const auto categories = payload.find("categories");
    if (categories == payload.end() || !categories->is_array())
    {
        ThrowInvalidPayload("Catalog categories must be an array.");
    }

    std::vector<domain::CatalogShelf> shelves;
    const auto games = ReadGames(payload);
    shelves.reserve(categories->size());
    for (const auto& category : *categories)
    {
        auto shelf = ReadShelf(category, 0);
        AttachGames(shelf, games);
        shelves.push_back(std::move(shelf));
    }
    return shelves;
}
}
