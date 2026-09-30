#pragma once

#include <optional>

#include "modules/session/infrastructure/SessionStorageFields.h"

namespace lila::modules::session::infrastructure
{
enum class SessionStorageMigration
{
    LegacyV0ToV1,
    CurrentV1,
};

[[nodiscard]] SessionStorageMigration ResolveSessionStorageMigration(
    std::optional<int> schemaVersion);
}
