#pragma once

#include <string_view>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure
{
[[nodiscard]] std::wstring_view GetLocalSoundFile(domain::SoundCue cue) noexcept;
}
