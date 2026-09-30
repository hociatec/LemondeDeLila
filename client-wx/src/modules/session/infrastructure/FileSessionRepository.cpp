#include "modules/session/infrastructure/FileSessionRepository.h"
#include "modules/session/infrastructure/SessionStorageFields.h"
#include "modules/session/infrastructure/SessionStorageMigration.h"
#include "modules/session/domain/SessionResumePolicy.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/errors/domain/ErrorFormatting.h"
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

int ReadSchemaVersion(const nlohmann::json& document)
{
    const auto iterator = document.find(
        lila::modules::session::infrastructure::fields::SchemaVersion);
    if (iterator == document.end())
    {
        // Version 0 is the only supported migration: it used the same fields
        // but omitted the version marker. Secrets still have to decrypt with
        // DPAPI, so this does not restore support for plaintext tokens.
        static_cast<void>(ResolveSessionStorageMigration(std::nullopt));
        return fields::LegacySchemaVersion;
    }
    if (!iterator->is_number_integer())
    {
        throw std::runtime_error(lila::shared::errors::InvalidSessionFile);
    }
    const int version = iterator->get<int>();
    static_cast<void>(ResolveSessionStorageMigration(version));
    return version;
}

domain::Session ParseSession(const nlohmann::json& document, int& schemaVersion)
{
    EnsureObject(document, lila::shared::errors::InvalidSessionFile);
    schemaVersion = ReadSchemaVersion(document);

    domain::Session session;
    session.userId = lila::shared::domain::UserId{
        lila::shared::data::json::ReadOptionalInteger(
            document,
            lila::modules::session::infrastructure::fields::UserId.data())};
    session.username = lila::shared::data::json::ReadOptionalString(
        document,
        lila::modules::session::infrastructure::fields::Username.data());

    const std::string protectedToken = lila::shared::data::json::ReadOptionalString(
        document,
        lila::modules::session::infrastructure::fields::Token.data());
    session.token = lila::shared::security::UnprotectSecret(protectedToken);
    try
    {
        session.roles = lila::shared::security::ReadJwtRoles(session.token);
    }
    catch (const std::exception&)
    {
        // Legacy test/dev sessions did not always carry a decodable JWT payload.
        // Such a session remains non-admin and the server still validates the token.
        session.roles.clear();
    }
    session.refreshToken = lila::shared::security::UnprotectSecret(
        lila::shared::data::json::ReadOptionalString(
            document,
            lila::modules::session::infrastructure::fields::RefreshToken.data()));

    session.expiresAt = lila::shared::data::json::ReadOptionalInteger64(
        document,
        lila::modules::session::infrastructure::fields::ExpiresAt.data());
    if (session.expiresAt <= 0)
    {
        session.expiresAt = lila::shared::security::ReadJwtExpiration(session.token);
    }
    session.resumeOnce = lila::shared::data::json::ReadOptionalBool(
        document,
        lila::modules::session::infrastructure::fields::ResumeOnce.data(),
        false);
    session.resumeUntil = lila::shared::data::json::ReadOptionalInteger64(
        document,
        lila::modules::session::infrastructure::fields::ResumeUntil.data());

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

    int schemaVersion = fields::CurrentSchemaVersion;
    domain::Session session;
    try
    {
        session = ParseSession(document, schemaVersion);
    }
    catch (const std::exception& error)
    {
        lila::shared::security::SecureDeleteFile(path.string());
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::InvalidSessionFile,
            error.what()));
    }
    const auto now = static_cast<std::int64_t>(std::time(nullptr));
    const bool canResume = session.IsAuthenticated()
        || (session.userId.IsValid() && !session.username.empty() && !session.refreshToken.empty());
    if (!canResume
        || (session.resumeOnce && !domain::IsResumeOnceWindowValid(session.resumeUntil, now)))
    {
        lila::shared::security::SecureDeleteFile(path.string());
        return std::nullopt;
    }

    if (session.resumeOnce)
    {
        lila::shared::security::SecureDeleteFile(path.string());
    }
    else if (schemaVersion == fields::LegacySchemaVersion)
    {
        // Complete the only supported local migration immediately so the
        // compatibility path cannot remain in use indefinitely.
        const_cast<FileSessionRepository*>(this)->Save(session);
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
        {std::string(fields::SchemaVersion), fields::CurrentSchemaVersion},
        {std::string(lila::modules::session::infrastructure::fields::UserId), session.userId.value},
        {std::string(lila::modules::session::infrastructure::fields::Username), session.username},
        {std::string(lila::modules::session::infrastructure::fields::Token), protectedToken},
        {std::string(fields::RefreshToken), session.refreshToken.empty() ? std::string{} : lila::shared::security::ProtectSecret(session.refreshToken)},
        {std::string(fields::ExpiresAt), expiresAt},
        {std::string(fields::ResumeOnce), false},
        {std::string(fields::ResumeUntil), 0}
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
    const auto resumeUntil = static_cast<std::int64_t>(std::time(nullptr)) +
        domain::ResumeOnceLifetimeSeconds;
    const nlohmann::json document = {
        {std::string(fields::SchemaVersion), fields::CurrentSchemaVersion},
        {std::string(lila::modules::session::infrastructure::fields::UserId), session.userId.value},
        {std::string(lila::modules::session::infrastructure::fields::Username), session.username},
        {std::string(lila::modules::session::infrastructure::fields::Token), lila::shared::security::ProtectSecret(session.token)},
        {std::string(fields::RefreshToken), session.refreshToken.empty() ? std::string{} : lila::shared::security::ProtectSecret(session.refreshToken)},
        {std::string(fields::ExpiresAt), expiresAt},
        {std::string(fields::ResumeOnce), true},
        {std::string(fields::ResumeUntil), resumeUntil}
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
