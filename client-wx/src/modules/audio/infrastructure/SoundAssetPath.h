#pragma once

#include <filesystem>
#include <string>
#include <unordered_map>
#include <unordered_set>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure
{
class SoundAssetPathResolver final
{
public:
    SoundAssetPathResolver();
    [[nodiscard]] std::filesystem::path Resolve(domain::SoundCue cue);

private:
    struct RemoteSound final
    {
        std::string url;
        std::string sha256;
        std::size_t bytes = 0;
    };

    void LoadRemoteManifest();
    [[nodiscard]] std::filesystem::path ResolveRemote(
        const std::string& soundId,
        const RemoteSound& sound);

    std::filesystem::path soundDirectory_;
    std::filesystem::path cacheDirectory_;
    std::unordered_map<std::string, RemoteSound> remoteSounds_;
    std::unordered_set<std::string> disabledSounds_;
    bool manifestLoaded_ = false;
};
}
