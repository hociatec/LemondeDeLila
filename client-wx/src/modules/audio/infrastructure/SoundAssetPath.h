#pragma once

#include <filesystem>
#include <chrono>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <stop_token>

#include "modules/audio/domain/SoundCue.h"
#include "modules/audio/infrastructure/SoundAssetManifest.h"

namespace lila::modules::audio::infrastructure
{
class SoundAssetPathResolver final
{
public:
    SoundAssetPathResolver();
    [[nodiscard]] std::filesystem::path Resolve(domain::SoundCue cue);
    [[nodiscard]] std::filesystem::path ResolvePreview(domain::SoundCue cue);
    void Invalidate();
    void SetStopToken(std::stop_token token) { stopToken_ = token; }
    void CleanupObsoleteAssets();

private:
    void LoadRemoteManifest();
    [[nodiscard]] std::filesystem::path ResolveRemote(
        const std::string& soundId,
        const RemoteSoundDescriptor& sound);

    std::filesystem::path soundDirectory_;
    std::filesystem::path cacheDirectory_;
    std::unordered_map<std::string, RemoteSoundDescriptor> remoteSounds_;
    std::unordered_set<std::string> disabledSounds_;
    bool manifestLoaded_ = false;
    std::chrono::steady_clock::time_point nextManifestAttempt_{};
    std::unordered_set<std::string> verifiedAssets_;
    std::stop_token stopToken_;
};
}
