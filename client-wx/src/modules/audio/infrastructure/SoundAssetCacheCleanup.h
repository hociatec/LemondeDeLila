#pragma once

#include <filesystem>
#include <string>
#include <unordered_map>

namespace lila::modules::audio::infrastructure
{
void CleanupRemoteSoundCache(
    const std::filesystem::path& cacheDirectory,
    const std::unordered_map<std::string, std::string>& currentHashes);
}
