#include "modules/session/infrastructure/FileSessionRepository.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/persistence/JsonFileStorage.h"

#include <nlohmann/json.hpp>

#include <stdexcept>
#include <string>

namespace lila::modules::session::infrastructure
{
namespace
{
domain::Session ParseSession(const nlohmann::json& document)
{
    if (!document.is_object())
    {
        throw std::runtime_error(lila::shared::errors::InvalidSessionFile);
    }

    domain::Session session;
    session.userId = lila::shared::data::json::ReadOptionalInteger(
        document,
        lila::shared::contracts::session::UserIdField.data());
    session.username = lila::shared::data::json::ReadOptionalString(
        document,
        lila::shared::contracts::session::UsernameField.data());
    session.token = lila::shared::data::json::ReadOptionalString(
        document,
        lila::shared::contracts::session::TokenField.data());
    return session;
}
}

std::optional<domain::Session> FileSessionRepository::Load() const
{
    const wxString path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
    nlohmann::json document;
    try
    {
        if (!lila::shared::persistence::JsonFileStorage::ReadIfExists(path, document))
        {
            return std::nullopt;
        }
    }
    catch (const std::exception& error)
    {
        throw std::runtime_error(std::string(lila::shared::errors::InvalidSessionFile) + " " + error.what());
    }

    auto session = ParseSession(document);
    if (!session.IsAuthenticated())
    {
        return std::nullopt;
    }

    return session;
}

void FileSessionRepository::Save(const domain::Session& session)
{
    if (!session.IsAuthenticated())
    {
        throw std::invalid_argument(lila::shared::errors::InvalidSessionUnauthenticated);
    }

    const wxString path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
    const nlohmann::json document = {
        {std::string(lila::shared::contracts::session::UserIdField), session.userId},
        {std::string(lila::shared::contracts::session::UsernameField), session.username},
        {std::string(lila::shared::contracts::session::TokenField), session.token}
    };

    lila::shared::persistence::JsonFileStorage::Write(
        path,
        document,
        lila::shared::errors::InvalidSessionSaveFailed);
}

void FileSessionRepository::Clear()
{
    const wxString path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
    lila::shared::persistence::JsonFileStorage::Remove(
        path,
        lila::shared::errors::FileSessionDeleteFailed);
}
}
