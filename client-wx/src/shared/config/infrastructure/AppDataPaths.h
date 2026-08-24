#pragma once

#include <filesystem>
#include <string_view>

namespace lila::shared::config
{
class AppDataPaths final
{
public:
    [[nodiscard]] static std::filesystem::path ResolveUserLocalDataDir();
    [[nodiscard]] static std::filesystem::path ResolveUserLocalFile(std::string_view fileName);

private:
    AppDataPaths() = default;
};
}
