#include "shared/config/AppConfig.h"
#include "AppBuildInfo.h"
#include "shared/text/StringUtils.h"

#include <cstdlib>
#include <memory>

namespace lila::shared::config
{
namespace
{
std::string ExtractOrigin(const std::string& endpoint)
{
    const std::size_t schemeSeparator = endpoint.find("://");
    if (schemeSeparator == std::string::npos)
    {
        return endpoint;
    }

    const std::size_t pathStart = endpoint.find('/', schemeSeparator + 3);
    if (pathStart == std::string::npos)
    {
        return endpoint;
    }

    return endpoint.substr(0, pathStart);
}

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
}

std::string AppConfig::ResolveBackendApiWs()
{
    const std::string endpoint = lila::shared::text::TrimCopy(ReadEnvironmentVariable(BackendApiWsEnvVar.data()));
    if (!endpoint.empty())
    {
        return endpoint;
    }

    return std::string(DefaultBackendApiWs);
}

std::string AppConfig::ResolvePresenceWs()
{
    return ExtractOrigin(ResolveBackendApiWs()) + "/presence";
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
}
