#include "modules/session/infrastructure/FileSessionRepository.h"
#include "modules/session/infrastructure/SessionStorageFields.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/errors/presentation/ErrorFormatting.h"
#include "shared/persistence/infrastructure/JsonFileStorage.h"
#include "shared/security/domain/JwtPayload.h"
#include "shared/security/infrastructure/SecurityUtils.h"

#include <nlohmann/json.hpp>

#include <stdexcept>
#include <string>
#include <ctime>

namespace lila::modules::session::infrastructure
{
namespace
{
using lila::shared::data::json::EnsureObject;

domain::Session ParseSession(const nlohmann::json& document)
{
    EnsureObject(document, lila::shared::errors::InvalidSessionFile);

    domain::Session session;
    session.userId = lila::shared::domain::UserId{
        lila::shared::data::json::ReadOptionalInteger(
            document,
            lila::modules::session::infrastructure::fields::UserId.data())};
    session.username = lila::shared::data::json::ReadOptionalString(
        document,
        lila::modules::session::infrastructure::fields::Username.data());

    std::string protectedOrRawToken = lila::shared::data::json::ReadOptionalString(
        document,
        lila::modules::session::infrastructure::fields::Token.data());
    session.token = lila::shared::security::UnprotectSecret(protectedOrRawToken);
    session.refreshToken = lila::shared::security::UnprotectSecret(
        lila::shared::data::json::ReadOptionalString(document, "refreshToken"));

    session.expiresAt = lila::shared::data::json::ReadOptionalInteger64(
        document,
        "expiresAt");
    if (session.expiresAt <= 0)
    {
        session.expiresAt = lila::shared::security::ReadJwtExpiration(session.token);
    }
    session.resumeOnce = document.value("resumeOnce", false);
    session.resumeUntil = lila::shared::data::json::ReadOptionalInteger64(
        document,
        "resumeUntil");

    return session;
}
}

std::optional<domain::Session> FileSessionRepository::Load() const
{
    const auto path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
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
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::InvalidSessionFile, error.what()));
    }

    auto session = ParseSession(document);
    const auto now = static_cast<std::int64_t>(std::time(nullptr));
    const bool canResume = session.IsAuthenticated()
        || (session.userId.IsValid() && !session.username.empty() && !session.refreshToken.empty());
    if (!canResume
        || (session.resumeOnce && (session.resumeUntil <= 0 || now > session.resumeUntil)))
    {
        lila::shared::security::SecureDeleteFile(path.string());
        return std::nullopt;
    }

    if (session.resumeOnce)
    {
        lila::shared::security::SecureDeleteFile(path.string());
    }

    return session;
}

void FileSessionRepository::Save(const domain::Session& session)
{
    if (!session.IsAuthenticated())
    {
        throw std::invalid_argument(lila::shared::errors::InvalidSessionUnauthenticated);
    }

    const auto path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
    const std::string protectedToken = lila::shared::security::ProtectSecret(session.token);
    const auto expiresAt = session.expiresAt > 0
        ? session.expiresAt
        : lila::shared::security::ReadJwtExpiration(session.token);

    const nlohmann::json document = {
        {std::string(lila::modules::session::infrastructure::fields::UserId), session.userId.value},
        {std::string(lila::modules::session::infrastructure::fields::Username), session.username},
        {std::string(lila::modules::session::infrastructure::fields::Token), protectedToken},
        {"refreshToken", session.refreshToken.empty() ? std::string{} : lila::shared::security::ProtectSecret(session.refreshToken)},
        {"expiresAt", expiresAt}
        ,{"resumeOnce", false}
        ,{"resumeUntil", 0}
    };

    lila::shared::persistence::JsonFileStorage::Write(
        path,
        document,
        lila::shared::errors::InvalidSessionSaveFailed);

    lila::shared::security::HardenFilePermissions(path.string());
}

void FileSessionRepository::SaveForRestart(const domain::Session& session)
{
    if (!session.IsAuthenticated()
        && !(session.userId.IsValid() && !session.username.empty() && !session.refreshToken.empty()))
    {
        throw std::invalid_argument(lila::shared::errors::InvalidSessionUnauthenticated);
    }

    const auto path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
    const auto expiresAt = session.expiresAt > 0
        ? session.expiresAt
        : lila::shared::security::ReadJwtExpiration(session.token);
    const auto resumeUntil = static_cast<std::int64_t>(std::time(nullptr)) + 120;
    const nlohmann::json document = {
        {std::string(lila::modules::session::infrastructure::fields::UserId), session.userId.value},
        {std::string(lila::modules::session::infrastructure::fields::Username), session.username},
        {std::string(lila::modules::session::infrastructure::fields::Token), lila::shared::security::ProtectSecret(session.token)},
        {"refreshToken", session.refreshToken.empty() ? std::string{} : lila::shared::security::ProtectSecret(session.refreshToken)},
        {"expiresAt", expiresAt},
        {"resumeOnce", true},
        {"resumeUntil", resumeUntil}
    };
    lila::shared::persistence::JsonFileStorage::Write(
        path,
        document,
        lila::shared::errors::InvalidSessionSaveFailed);
    lila::shared::security::HardenFilePermissions(path.string());
}

void FileSessionRepository::Clear()
{
    const auto path = lila::shared::persistence::JsonFileStorage::ResolvePath("session.json");
    lila::shared::security::SecureDeleteFile(path.string());
}
}
