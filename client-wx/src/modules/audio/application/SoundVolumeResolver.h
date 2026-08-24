#pragma once

#include "modules/audio/application/AudioSettings.h"
#include "modules/audio/domain/SoundCatalog.h"

namespace lila::modules::audio::application
{
[[nodiscard]] ResolvedPlaybackSettings ResolvePlaybackSettings(
    const domain::SoundDescriptor& sound,
    const AudioSettings& settings) noexcept;
}
