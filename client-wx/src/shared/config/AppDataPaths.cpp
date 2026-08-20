#include "shared/config/AppDataPaths.h"

#include <cstdlib>
#include <filesystem>
#include <stdexcept>
#include <string>

namespace lila::shared::config
{
namespace
{
std::filesystem::path ResolveBaseDirectory()
{
#ifdef _WIN32
    if (const char* localAppData = std::getenv("LOCALAPPDATA"))
    {
        if (*localAppData != '\0')
        {
            return std::filesystem::path(localAppData);
        }
    }

    if (const char* appData = std::getenv("APPDATA"))
    {
        if (*appData != '\0')
        {
            return std::filesystem::path(appData);
        }
    }
#else
    if (const char* xdgDataHome = std::getenv("XDG_DATA_HOME"))
    {
        if (*xdgDataHome != '\0')
        {
            return std::filesystem::path(xdgDataHome);
        }
    }

    if (const char* home = std::getenv("HOME"))
    {
        if (*home != '\0')
        {
            return std::filesystem::path(home) / ".local" / "share";
        }
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
