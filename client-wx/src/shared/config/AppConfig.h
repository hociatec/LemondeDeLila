#pragma once

#include <string>
#include <string_view>

namespace lila::shared::config
{
struct AppConfig
{
    static constexpr std::string_view AppTitle = "Le Monde de Lila";
    static constexpr std::string_view DefaultBackendApiWs = "wss://ws.lilas.hociatec.fr/ws/api";
    static constexpr std::string_view LocalBackendApiWs = "ws://127.0.0.1:3000/ws/api";
    static constexpr std::string_view ProductionBackendApiWs = DefaultBackendApiWs;
    static constexpr std::string_view BackendApiWsEnvVar = "LILA_BACKEND_API_WS";
    static constexpr std::string_view ClientVersionEnvVar = "LILA_CLIENT_VERSION";

    [[nodiscard]] static std::string ResolveBackendApiWs();
    [[nodiscard]] static std::string ResolvePresenceWs();
    [[nodiscard]] static std::string ResolveClientVersion();
};
}
