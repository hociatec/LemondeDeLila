#pragma once

#include <filesystem>

namespace lila::modules::update::launcher
{
void CleanupUpdateStagingDirectory(const std::filesystem::path& staging);
}
