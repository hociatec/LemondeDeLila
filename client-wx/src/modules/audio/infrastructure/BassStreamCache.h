#pragma once

#include <atomic>
#include <filesystem>
#include <chrono>
#include <optional>
#include <unordered_map>
#include <unordered_set>

#include "modules/audio/domain/SoundCue.h"
#include "modules/audio/infrastructure/BassApi.h"

namespace lila::modules::audio::infrastructure
{
class BassStreamCache final
{
public:
    void Preload(domain::SoundCue cue, const std::filesystem::path& path);
    void StartOrUpdate(
        domain::SoundCue cue,
        const std::filesystem::path& path,
        float volume,
        const std::atomic_bool& cancelled);
    void Stop() noexcept;
    void Clear() noexcept;

private:
    [[nodiscard]] HSTREAM GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path);

    std::unordered_map<domain::SoundCue, HSTREAM> streams_;
    std::unordered_map<domain::SoundCue, std::filesystem::path> paths_;
    std::unordered_map<domain::SoundCue, std::chrono::steady_clock::time_point> failed_;
    std::optional<domain::SoundCue> current_;
};
}
