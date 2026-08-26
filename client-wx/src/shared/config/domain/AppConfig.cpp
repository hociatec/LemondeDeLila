#include "shared/config/domain/AppConfig.h"
#include "AppBuildInfo.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/text/domain/StringUtils.h"
#include "shared/network/domain/UrlUtils.h"

#include <cstdlib>
#include <memory>
#include <optional>
#include <charconv>

namespace lila::shared::config
{
namespace
{
std::string ReadEnvironmentVariable(const char* name)
{
#ifdef _MSC_VER
    char* rawValue = nullptr;
    std::size_t rawSize = 0;
    if (_dupenv_s(&rawValue, &rawSize, name) != 0 || rawValue == nullptr)
    {
        return {};
    }

    std::unique_ptr<char, decltype(&std::free)> value(rawValue, &std::free);
    return std::string(value.get());
#else
    const char* value = std::getenv(name);
    return value == nullptr ? std::string{} : std::string(value);
#endif
}

std::optional<int> ReadPositiveIntEnvironmentVariable(const char* name)
{
    const std::string raw = lila::shared::text::TrimCopy(ReadEnvironmentVariable(name));
    if (raw.empty())
    {
        return std::nullopt;
    }

    int value = 0;
    const auto* begin = raw.data();
    const auto* end = raw.data() + raw.size();
    const auto result = std::from_chars(begin, end, value);
    if (result.ec != std::errc{} || result.ptr != end || value <= 0)
    {
        return std::nullopt;
    }

    return value;
}

BackendProfile ParseBackendProfile(const std::string& rawProfile)
{
    const std::string profile = lila::shared::text::TrimCopy(rawProfile);
    if (profile == "local")
    {
        return BackendProfile::Local;
    }

    return BackendProfile::Production;
}
}

BackendProfile AppConfig::ResolveBackendProfile()
{
    return ParseBackendProfile(ReadEnvironmentVariable(BackendProfileEnvVar.data()));
}

std::string AppConfig::ResolveBackendApiWs()
{
    const std::string endpoint = lila::shared::text::TrimCopy(ReadEnvironmentVariable(BackendApiWsEnvVar.data()));
    if (!endpoint.empty())
    {
        return endpoint;
    }

    switch (ResolveBackendProfile())
    {
    case BackendProfile::Local:
        return std::string(LocalBackendApiWs);
    case BackendProfile::Production:
    default:
        return std::string(ProductionBackendApiWs);
    }
}

std::string AppConfig::ResolvePresenceWs()
{
    return lila::shared::network::ExtractOrigin(ResolveBackendApiWs()) + std::string(lila::shared::network::ws::PresencePath);
}

std::string AppConfig::ResolveClientVersion()
{
    const std::string version = lila::shared::text::TrimCopy(ReadEnvironmentVariable(ClientVersionEnvVar.data()));
    if (!version.empty())
    {
        return version;
    }

    return std::string(AppBuildInfo::VersionFull);
}

std::optional<std::size_t> AppConfig::ResolveBackgroundWorkerCount()
{
    const auto value = ReadPositiveIntEnvironmentVariable(BackgroundWorkersEnvVar.data());
    if (!value.has_value())
    {
        return std::nullopt;
    }

    return static_cast<std::size_t>(*value);
}

int AppConfig::ResolveChatReconnectInitialDelayMs()
{
    return ReadPositiveIntEnvironmentVariable(ChatReconnectInitialDelayMsEnvVar.data()).value_or(300);
}

int AppConfig::ResolveChatReconnectMaxDelayMs()
{
    return ReadPositiveIntEnvironmentVariable(ChatReconnectMaxDelayMsEnvVar.data()).value_or(3000);
}
}
