#pragma once

#include <cstddef>
#include <string>
#include <string_view>
#include <optional>

namespace lila::shared::config
{
enum class BackendProfile
{
    Production,
    Local,
};

struct AppConfig
{
    static constexpr std::string_view AppTitle = "Le Monde de Lila";
    static constexpr int RealtimeProtocolVersion = 1;
    static constexpr std::string_view DefaultBackendApiWs = "wss://ws.lilas.hociatec.fr/ws/api";
    static constexpr std::string_view LocalBackendApiWs = "ws://127.0.0.1:3000/ws/api";
    static constexpr std::string_view ProductionBackendApiWs = DefaultBackendApiWs;
    static constexpr std::string_view BackendProfileEnvVar = "LILA_BACKEND_PROFILE";
    static constexpr std::string_view BackendApiWsEnvVar = "LILA_BACKEND_API_WS";
    static constexpr std::string_view ClientVersionEnvVar = "LILA_CLIENT_VERSION";
    static constexpr std::string_view BackgroundWorkersEnvVar = "LILA_BACKGROUND_WORKERS";
    static constexpr std::string_view ChatReconnectInitialDelayMsEnvVar = "LILA_CHAT_RECONNECT_INITIAL_DELAY_MS";
    static constexpr std::string_view ChatReconnectMaxDelayMsEnvVar = "LILA_CHAT_RECONNECT_MAX_DELAY_MS";

    [[nodiscard]] static BackendProfile ResolveBackendProfile();
    [[nodiscard]] static std::string ResolveBackendProfileName();
    [[nodiscard]] static std::string ResolveBackendApiWs();
    [[nodiscard]] static std::string ResolvePresenceWs();
    [[nodiscard]] static std::string ResolveClientVersion();
    [[nodiscard]] static std::optional<std::size_t> ResolveBackgroundWorkerCount();
    [[nodiscard]] static int ResolveChatReconnectInitialDelayMs();
    [[nodiscard]] static int ResolveChatReconnectMaxDelayMs();
};
}
