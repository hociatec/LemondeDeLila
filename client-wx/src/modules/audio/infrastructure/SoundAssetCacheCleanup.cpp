#include "modules/audio/infrastructure/SoundAssetCacheCleanup.h"

namespace lila::modules::audio::infrastructure
{
void CleanupRemoteSoundCache(
    const std::filesystem::path& cacheDirectory,
    const std::unordered_map<std::string, std::string>& currentHashes)
{
    std::error_code error;
    if (cacheDirectory.empty() || !std::filesystem::is_directory(cacheDirectory, error)) return;
    for (const auto& soundDirectory : std::filesystem::directory_iterator(cacheDirectory, error))
    {
        if (error || !soundDirectory.is_directory(error)) continue;
        const auto found = currentHashes.find(soundDirectory.path().filename().string());
        const auto keep = found == currentHashes.end() ? std::string{} : found->second + ".wav";
        for (const auto& file : std::filesystem::directory_iterator(soundDirectory.path(), error))
        {
            if (error) break;
            if (file.is_regular_file(error) && file.path().filename().string() != keep)
                std::filesystem::remove(file.path(), error);
        }
        if (found == currentHashes.end()) std::filesystem::remove(soundDirectory.path(), error);
    }
}
}
