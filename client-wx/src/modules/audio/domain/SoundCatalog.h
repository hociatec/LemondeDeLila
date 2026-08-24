#pragma once

#include <span>
#include <string_view>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::domain
{
enum class SoundFamily
{
    AppLaunch,
    Ambience,
    Navigate,
    Select,
    Messages,
    TableAmbience,
};

struct SoundDescriptor final
{
    SoundCue cue;
    std::string_view key;
    SoundFamily family;
    bool loop;
};

[[nodiscard]] std::span<const SoundDescriptor> GetSoundCatalog() noexcept;
[[nodiscard]] const SoundDescriptor* FindSoundDescriptor(SoundCue cue) noexcept;
}
