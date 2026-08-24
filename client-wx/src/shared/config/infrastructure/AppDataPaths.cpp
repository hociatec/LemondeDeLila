#include "shared/config/infrastructure/AppDataPaths.h"

#include <cstdlib>
#include <filesystem>
#include <stdexcept>
#include <string>

namespace lila::shared::config
{
namespace
{
std::string ReadEnvironmentVariable(const char* name)
{
#ifdef _WIN32
    char* rawValue = nullptr;
    std::size_t valueLength = 0;
    const errno_t result = _dupenv_s(&rawValue, &valueLength, name);
    const std::string value = result == 0 && rawValue != nullptr ? rawValue : "";
    std::free(rawValue);
    return value;
#else
    const char* value = std::getenv(name);
    return value != nullptr ? std::string(value) : std::string();
#endif
}

std::filesystem::path ResolveBaseDirectory()
{
#ifdef _WIN32
    const std::string localAppData = ReadEnvironmentVariable("LOCALAPPDATA");
    if (!localAppData.empty())
    {
        return std::filesystem::path(localAppData);
    }

    const std::string appData = ReadEnvironmentVariable("APPDATA");
    if (!appData.empty())
    {
        return std::filesystem::path(appData);
    }
#else
    const std::string xdgDataHome = ReadEnvironmentVariable("XDG_DATA_HOME");
    if (!xdgDataHome.empty())
    {
        return std::filesystem::path(xdgDataHome);
    }

    const std::string userHome = ReadEnvironmentVariable("HOME");
    if (!userHome.empty())
    {
        return std::filesystem::path(userHome) / ".local" / "share";
    }
#endif

    return std::filesystem::temp_directory_path();
}
}

std::filesystem::path AppDataPaths::ResolveUserLocalDataDir()
{
    const auto path = ResolveBaseDirectory() / "LeMondeDeLilaWX";
    std::filesystem::create_directories(path);
    return path;
}

std::filesystem::path AppDataPaths::ResolveUserLocalFile(std::string_view fileName)
{
    return ResolveUserLocalDataDir() / std::filesystem::path(fileName);
}
}
