#pragma once

#include <filesystem>
#include <string_view>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure
{
[[nodiscard]] std::wstring_view GetLocalSoundFile(domain::SoundCue cue) noexcept;
[[nodiscard]] std::filesystem::path FindLocalSoundAsset(
    const std::filesystem::path& directory,
    domain::SoundCue cue) noexcept;
}
