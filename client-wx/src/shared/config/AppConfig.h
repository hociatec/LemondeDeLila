#pragma once

#include <string>
#include <string_view>
#include "shared/contracts/BackendWsContracts.h"

namespace lila::shared::config
{
struct AppConfig
{
    static constexpr std::string_view AppTitle = "Le Monde de Lila";
    static constexpr std::string_view DefaultBackendApiWs = lila::shared::contracts::config::DefaultBackendApiWs;
    static constexpr std::string_view LocalBackendApiWs = lila::shared::contracts::config::LocalBackendApiWs;
    static constexpr std::string_view ProductionBackendApiWs = lila::shared::contracts::config::ProductionBackendApiWs;
    static constexpr std::string_view BackendApiWsEnvVar = lila::shared::contracts::config::BackendApiWsEnvVar;
    static constexpr std::string_view ClientVersionEnvVar = lila::shared::contracts::config::ClientVersionEnvVar;

    [[nodiscard]] static std::string ResolveBackendApiWs();
    [[nodiscard]] static std::string ResolvePresenceWs();
    [[nodiscard]] static std::string ResolveClientVersion();
};
}
