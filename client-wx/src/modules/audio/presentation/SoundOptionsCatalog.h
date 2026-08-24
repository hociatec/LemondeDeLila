#pragma once

#include <span>
#include <string_view>

#include "modules/audio/domain/SoundCatalog.h"

namespace lila::modules::audio::presentation
{
struct SoundOption final
{
    domain::SoundCue cue;
    std::wstring_view label;
};

[[nodiscard]] std::span<const SoundOption> GetSoundOptions() noexcept;
[[nodiscard]] std::wstring_view GetSoundFamilyLabel(domain::SoundFamily family) noexcept;
}
