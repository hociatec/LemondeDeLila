#pragma once

#include "modules/audio/application/AudioSettings.h"

namespace lila::modules::audio::application
{
class IAudioSettingsProvider
{
public:
    virtual ~IAudioSettingsProvider() = default;
    [[nodiscard]] virtual AudioSettings Snapshot() const = 0;
};
}
