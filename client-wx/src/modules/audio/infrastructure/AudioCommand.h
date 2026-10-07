#pragma once
#include <optional>
#include <memory>
#include <stdexcept>
#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure::detail
{
enum class CommandType { Preload, Play, Preview, SetPreviewVolume, TogglePreviewPause, SetLoop, StopAll, RefreshAssets };
struct Command final
{
    CommandType type;
    std::optional<domain::SoundCue> cue;
    float volume = 0.0F;
};
inline std::unique_ptr<application::IAudioBackend> RequireBackend(
    std::unique_ptr<application::IAudioBackend> backend)
{
    if (!backend) throw std::invalid_argument("Audio backend is required.");
    return backend;
}
}
