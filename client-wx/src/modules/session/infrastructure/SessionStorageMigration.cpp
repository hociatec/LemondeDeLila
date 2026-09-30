#include "modules/session/infrastructure/SessionStorageMigration.h"

#include <stdexcept>

#include "shared/errors/catalog/CoreErrorMessages.h"

namespace lila::modules::session::infrastructure
{
SessionStorageMigration ResolveSessionStorageMigration(
    std::optional<int> schemaVersion)
{
    if (!schemaVersion.has_value() || *schemaVersion == fields::LegacySchemaVersion)
        return SessionStorageMigration::LegacyV0ToV1;
    if (*schemaVersion == fields::CurrentSchemaVersion)
        return SessionStorageMigration::CurrentV1;
    throw std::runtime_error(lila::shared::errors::InvalidSessionFile);
}
}
